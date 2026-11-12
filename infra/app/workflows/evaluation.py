"""Evaluasi akurasi deteksi terhadap anotasi manusia (export Label Studio).

Fungsi di sini murni (tanpa jaringan) supaya mudah dites. Panggilan API ada di scripts/evaluate.py.
Metrik: precision / recall / F1 per kelas pada IoU tertentu, plus mode "hanya lokalisasi"
(abaikan label) untuk memisahkan masalah kotak meleset dari masalah salah kelas.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from itertools import product

from ..vision.cables import CABLE_PROMPTS, to_cables
from ..vision.detect import CLASS_BY_PROMPT, DEDUPE_IOU, MIN_CONFIDENCE, Unit, clean_units, iou, to_units
from ..common.geometry import BBox, Detection
from .labeling import CABLE_LABELS, pick_results

AGNOSTIC = "(semua kelas)"


@dataclass(frozen=True)
class Box:
    label: str
    bbox: BBox
    score: float = 1.0


@dataclass
class ClassScore:
    tp: int = 0
    fp: int = 0
    fn: int = 0
    ious: list[float] = field(default_factory=list)

    @property
    def precision(self) -> float:
        return self.tp / (self.tp + self.fp) if self.tp + self.fp else 0.0

    @property
    def recall(self) -> float:
        return self.tp / (self.tp + self.fn) if self.tp + self.fn else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if p + r else 0.0

    @property
    def mean_iou(self) -> float:
        return sum(self.ious) / len(self.ious) if self.ious else 0.0


def gt_from_task(task: dict) -> list[Box] | None:
    """Kotak GT dari anotasi manusia terbaru (bbox ternormalisasi). None = task belum dianotasi."""
    results = pick_results(task, include_predictions=False)
    if results is None:
        return None
    out: list[Box] = []
    for r in results:
        if r.get("type") != "rectanglelabels":
            continue
        v = r["value"]
        labels = v.get("rectanglelabels") or [""]
        out.append(Box(labels[0], (v["x"] / 100.0, v["y"] / 100.0, v["width"] / 100.0, v["height"] / 100.0)))
    return out


def match_image(preds: list[Box], gts: list[Box], iou_thr: float = 0.5, ignore_label: bool = False) -> dict[str, ClassScore]:
    """Cocokkan prediksi ke GT secara greedy (skor tertinggi dulu); satu GT hanya untuk satu prediksi."""
    scores: dict[str, ClassScore] = defaultdict(ClassScore)
    used: set[int] = set()
    key = (lambda b: AGNOSTIC) if ignore_label else (lambda b: b.label)

    for p in sorted(preds, key=lambda b: b.score, reverse=True):
        best, best_iou = None, iou_thr
        for gi, g in enumerate(gts):
            if gi in used or (not ignore_label and g.label != p.label):
                continue
            v = iou(p.bbox, g.bbox)
            if v >= best_iou:
                best, best_iou = gi, v
        if best is None:
            scores[key(p)].fp += 1
        else:
            used.add(best)
            s = scores[key(p)]
            s.tp += 1
            s.ious.append(best_iou)
    for gi, g in enumerate(gts):
        if gi not in used:
            scores[key(g)].fn += 1
    return scores


def evaluate(pairs: list[tuple[list[Box], list[Box]]], iou_thr: float = 0.5, ignore_label: bool = False) -> dict[str, ClassScore]:
    """Gabungkan hitungan dari semua gambar. pairs = [(prediksi, GT), ...]."""
    total: dict[str, ClassScore] = defaultdict(ClassScore)
    for preds, gts in pairs:
        for name, s in match_image(preds, gts, iou_thr, ignore_label).items():
            t = total[name]
            t.tp, t.fp, t.fn = t.tp + s.tp, t.fp + s.fp, t.fn + s.fn
            t.ious.extend(s.ious)
    return dict(total)


def overall(scores: dict[str, ClassScore]) -> ClassScore:
    """Micro-average: jumlahkan TP/FP/FN semua kelas."""
    t = ClassScore()
    for s in scores.values():
        t.tp, t.fp, t.fn = t.tp + s.tp, t.fp + s.fp, t.fn + s.fn
        t.ious.extend(s.ious)
    return t


# ─── Prediksi dari deteksi mentah (cache) ─────────────────────────────────

RawDets = dict[str, list[dict]]  # prompt -> [{"bbox": [x,y,w,h], "confidence": float|None}]


def dets_to_raw(by_prompt: dict[str, list[Detection]]) -> RawDets:
    return {p: [{"bbox": list(d.bbox), "confidence": d.confidence} for d in dets] for p, dets in by_prompt.items()}


def _detections(raw: RawDets, prompts) -> dict[str, list[Detection]]:
    return {
        p: [Detection(p, tuple(d["bbox"]), d.get("confidence")) for d in raw.get(p, [])]
        for p in prompts
    }


def unit_preds(raw: RawDets, min_conf: float = MIN_CONFIDENCE, iou_thr: float = DEDUPE_IOU) -> list[Box]:
    units: list[Unit] = clean_units(to_units(_detections(raw, CLASS_BY_PROMPT)), min_conf, iou_thr)
    return [Box(u.cls.nama, u.bbox, u.confidence) for u in units]


def cable_preds(raw: RawDets) -> list[Box]:
    return [
        Box(CABLE_LABELS.get(c.kind, CABLE_LABELS["data"]), c.bbox, c.confidence)
        for c in to_cables(_detections(raw, CABLE_PROMPTS))
    ]


def is_cable_label(label: str) -> bool:
    return label in CABLE_LABELS.values()


def split_gt(gts: list[Box]) -> tuple[list[Box], list[Box]]:
    """(GT unit, GT kabel). Kabel dievaluasi terpisah: pelabelannya per-kabel jauh lebih subjektif."""
    return [g for g in gts if not is_cable_label(g.label)], [g for g in gts if is_cable_label(g.label)]


def sweep(
    raw_by_image: list[RawDets],
    gts_by_image: list[list[Box]],
    min_confs=(0.2, 0.3, 0.4, 0.5, 0.6),
    iou_thrs=(0.4, 0.5, 0.6, 0.7),
    match_iou: float = 0.5,
) -> list[dict]:
    """Coba kombinasi ambang keyakinan dan NMS; urut dari F1 (hanya lokalisasi unit) tertinggi."""
    unit_gts = [split_gt(g)[0] for g in gts_by_image]
    rows = []
    for mc, it in product(min_confs, iou_thrs):
        pairs = [(unit_preds(raw, mc, it), g) for raw, g in zip(raw_by_image, unit_gts)]
        loc = overall(evaluate(pairs, match_iou, ignore_label=True))
        cls = overall(evaluate(pairs, match_iou))
        rows.append(
            {
                "min_confidence": mc,
                "nms_iou": it,
                "loc_precision": loc.precision,
                "loc_recall": loc.recall,
                "loc_f1": loc.f1,
                "cls_f1": cls.f1,
                "mean_iou": loc.mean_iou,
            }
        )
    rows.sort(key=lambda r: (-r["loc_f1"], -r["cls_f1"]))
    return rows


# ─── Kesiapan melatih YOLO ────────────────────────────────────────────────

# Angka rekomendasi Ultralytics (YOLOv5 "Tips for Best Training Results"): >= 1500 gambar dan
# >= 10000 instance per kelas untuk hasil terbaik; bobot pretrained dianjurkan untuk dataset kecil-menengah.
ULTRALYTICS_IMAGES_PER_CLASS = 1500
ULTRALYTICS_INSTANCES_PER_CLASS = 10000
# Ambang tahap awal di bawah ini adalah PERKIRAAN praktis kami, bukan angka resmi.
TRIAL_MIN_IMAGES = 50
TRIAL_MIN_INSTANCES = 100


def yolo_readiness(n_images: int, instances_per_class: dict[str, int]) -> dict:
    """Tahap kesiapan melatih detector sendiri. Kelas dengan 0 instance diabaikan dari penilaian."""
    present = {k: v for k, v in instances_per_class.items() if v > 0}
    weakest = min(present.values()) if present else 0
    if n_images < TRIAL_MIN_IMAGES or weakest < TRIAL_MIN_INSTANCES:
        tier = "belum"
        note = (
            f"Belum cukup: butuh sekitar {TRIAL_MIN_IMAGES}+ gambar dan {TRIAL_MIN_INSTANCES}+ instance di tiap kelas "
            "yang ingin dideteksi (perkiraan praktis). Tetap pakai SAM + Muse."
        )
    elif n_images < ULTRALYTICS_IMAGES_PER_CLASS or weakest < ULTRALYTICS_INSTANCES_PER_CLASS:
        tier = "uji-coba"
        note = (
            "Cukup untuk uji coba fine-tune dari bobot pretrained dan membandingkan dengan SAM + Muse. "
            f"Rekomendasi Ultralytics untuk hasil terbaik: {ULTRALYTICS_IMAGES_PER_CLASS}+ gambar dan "
            f"{ULTRALYTICS_INSTANCES_PER_CLASS}+ instance per kelas."
        )
    else:
        tier = "memadai"
        note = "Memenuhi rekomendasi jumlah data Ultralytics. Pastikan variasi foto dan konsistensi label juga baik."
    return {
        "tier": tier,
        "images": n_images,
        "weakest_class_instances": weakest,
        "classes_without_data": sorted(k for k, v in instances_per_class.items() if v == 0),
        "note": note,
    }
