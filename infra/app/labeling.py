"""Pra-label ke Label Studio dan konversi hasil koreksi ke dataset YOLO.

Alur: hasil analyze_rack -> task Label Studio (prediksi) -> dikoreksi manual di Label Studio ->
export JSON -> dataset YOLO (images/, labels/, data.yaml) untuk training detector sendiri nanti.

Format Label Studio: x/y/width/height dalam PERSEN dimensi gambar (https://labelstud.io/guide/export).
Format YOLO: "class cx cy w h" ternormalisasi 0..1.
"""

import hashlib
import shutil
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from .detect import UNIT_CLASSES
from .geometry import BBox
from .pipeline import RackAnalysis

MODEL_VERSION = "neatops-sam-muse"
FROM_NAME = "label"
TO_NAME = "image"

CABLE_LABELS = {"data": "Kabel Data", "daya": "Kabel Daya", "bundel": "Bundel Kabel"}
# Beberapa prompt SAM berbagi satu nama kelas (mis. dua prompt umum -> "Perangkat"), jadi dedup urut-tetap.
LABEL_CLASSES: list[str] = list(dict.fromkeys(c.nama for c in UNIT_CLASSES)) + list(CABLE_LABELS.values())
CLASS_ID = {name: i for i, name in enumerate(LABEL_CLASSES)}

_PALETTE = ["#3b82d6", "#2a9d5c", "#c98a0b", "#d23a40", "#7c5fc4", "#12a594", "#db2777", "#625e52", "#8a8576", "#5f7d10"]


def label_config() -> str:
    """Labeling config XML untuk Label Studio (RectangleLabels dengan semua kelas)."""
    labels = "\n".join(
        f'    <Label value="{name}" background="{_PALETTE[i % len(_PALETTE)]}"/>'
        for i, name in enumerate(LABEL_CLASSES)
    )
    return (
        "<View>\n"
        f'  <Image name="{TO_NAME}" value="$image" zoom="true"/>\n'
        f'  <RectangleLabels name="{FROM_NAME}" toName="{TO_NAME}">\n{labels}\n  </RectangleLabels>\n'
        "</View>\n"
    )


def _pct(v: float) -> float:
    return round(max(0.0, min(100.0, v * 100.0)), 4)


def rect_result(rid: str, label: str, bbox: BBox, width: int, height: int, score: float | None) -> dict | None:
    """Satu kotak -> result Label Studio (persen). None bila kotak kosong setelah dipotong ke gambar."""
    x, y = _pct(bbox[0]), _pct(bbox[1])
    w = min(_pct(bbox[2]), 100.0 - x)
    h = min(_pct(bbox[3]), 100.0 - y)
    if w <= 0 or h <= 0:
        return None
    res = {
        "id": rid,
        "type": "rectanglelabels",
        "from_name": FROM_NAME,
        "to_name": TO_NAME,
        "original_width": width,
        "original_height": height,
        "image_rotation": 0,
        "value": {"x": x, "y": y, "width": round(w, 4), "height": round(h, 4), "rotation": 0, "rectanglelabels": [label]},
    }
    if score is not None:
        res["score"] = round(score, 4)
    return res


def task_from_analysis(image_ref: str, analysis: RackAnalysis, size: tuple[int, int] | None = None) -> dict:
    """Task Label Studio dengan satu prediksi berisi semua unit dan kabel hasil deteksi."""
    width, height = size or (analysis.width, analysis.height)
    results: list[dict] = []
    scores: list[float] = []

    def add(label: str, bbox: BBox, score: float | None) -> None:
        r = rect_result(f"r{len(results) + 1}", label, bbox, width, height, score)
        if r is not None:
            results.append(r)
            if score is not None:
                scores.append(score)

    for u in analysis.units:
        add(u.cls.nama, u.bbox, u.confidence)
    for cluster in analysis.cables:
        for c in cluster.cables:
            add(CABLE_LABELS.get(c.kind, CABLE_LABELS["data"]), c.bbox, c.confidence)

    return {
        "data": {"image": image_ref},
        "predictions": [
            {
                "model_version": MODEL_VERSION,
                "score": round(sum(scores) / len(scores), 4) if scores else 0.0,
                "result": results,
            }
        ],
    }


# ─── Label Studio export -> YOLO ──────────────────────────────────────────


def image_basename(ref: str) -> str:
    """Nama file dari data.image, termasuk bentuk '/data/local-files/?d=folder/rak.jpg' dan URL biasa."""
    parsed = urlparse(ref)
    d = parse_qs(parsed.query).get("d")
    path = d[0] if d else parsed.path
    return Path(unquote(path)).name


def yolo_line(label: str, value: dict) -> str | None:
    """Result persen -> baris YOLO. None bila label tak dikenal, berotasi, atau kotaknya tak valid."""
    if label not in CLASS_ID or value.get("rotation", 0) not in (0, 0.0):
        return None
    x, y, w, h = (value[k] / 100.0 for k in ("x", "y", "width", "height"))
    x0, y0, x1, y1 = (max(0.0, min(1.0, v)) for v in (x, y, x + w, y + h))
    if x1 <= x0 or y1 <= y0:
        return None
    cx, cy, bw, bh = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    return f"{CLASS_ID[label]} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}"


def pick_results(task: dict, include_predictions: bool) -> list[dict] | None:
    """Hasil anotasi manusia terbaru yang tidak dibatalkan. None = task belum dianotasi."""
    done = [a for a in task.get("annotations", []) if not a.get("was_cancelled") and "result" in a]
    if done:
        return done[-1]["result"]
    if include_predictions and task.get("predictions"):
        return task["predictions"][0].get("result", [])
    return None


@dataclass
class ConvertReport:
    images: int = 0
    boxes: int = 0
    per_class: Counter = field(default_factory=Counter)
    skipped_labels: Counter = field(default_factory=Counter)  # label tak dikenal / rotasi / kotak tak valid
    missing_images: list[str] = field(default_factory=list)
    unannotated_tasks: int = 0
    train: int = 0
    val: int = 0


def is_val(stem: str, val_ratio: float) -> bool:
    """Pembagian train/val deterministik berdasarkan nama file (stabil antar eksekusi)."""
    bucket = int(hashlib.sha1(stem.encode("utf-8")).hexdigest(), 16) % 1000
    return bucket < val_ratio * 1000


def data_yaml(out_dir: Path) -> str:
    names = "\n".join(f"  {i}: {n}" for i, n in enumerate(LABEL_CLASSES))
    return f"path: {out_dir.resolve().as_posix()}\ntrain: images/train\nval: images/val\nnames:\n{names}\n"


def convert_export_to_yolo(
    tasks: list[dict],
    images_dir: Path,
    out_dir: Path,
    val_ratio: float = 0.2,
    include_predictions: bool = False,
) -> ConvertReport:
    report = ConvertReport()
    items: list[tuple[Path, list[str]]] = []

    for task in tasks:
        results = pick_results(task, include_predictions)
        if results is None:
            report.unannotated_tasks += 1
            continue
        name = image_basename(task.get("data", {}).get("image", ""))
        src = images_dir / name
        if not name or not src.is_file():
            report.missing_images.append(name or "(tanpa nama)")
            continue
        lines: list[str] = []
        for r in results:
            if r.get("type") != "rectanglelabels":
                continue
            labels = r["value"].get("rectanglelabels") or [""]
            line = yolo_line(labels[0], r["value"])
            if line is None:
                report.skipped_labels[labels[0] or "(tanpa label)"] += 1
                continue
            lines.append(line)
            report.per_class[labels[0]] += 1
        items.append((src, lines))

    # Pembagian: deterministik; pastikan val tidak kosong bila ada >= 2 gambar.
    split = [(src, lines, is_val(src.stem, val_ratio)) for src, lines in items]
    if len(split) >= 2 and not any(v for _, _, v in split):
        src, lines, _ = split[-1]
        split[-1] = (src, lines, True)
    if len(split) >= 2 and all(v for _, _, v in split):
        src, lines, _ = split[0]
        split[0] = (src, lines, False)

    for sub in ("train", "val"):
        (out_dir / "images" / sub).mkdir(parents=True, exist_ok=True)
        (out_dir / "labels" / sub).mkdir(parents=True, exist_ok=True)

    def write(src: Path, lines: list[str], sub: str) -> None:
        shutil.copy2(src, out_dir / "images" / sub / src.name)
        (out_dir / "labels" / sub / f"{src.stem}.txt").write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

    for src, lines, val in split:
        write(src, lines, "val" if val else "train")
        report.val += val
        report.train += not val
        report.images += 1
        report.boxes += len(lines)
    if len(split) == 1:  # satu gambar saja: YOLO tetap butuh val, pakai gambar yang sama
        write(split[0][0], split[0][1], "val")
        report.val += 1

    (out_dir / "data.yaml").write_text(data_yaml(out_dir), encoding="utf-8")
    return report
