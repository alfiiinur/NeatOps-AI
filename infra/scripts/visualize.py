"""Jalankan pipeline penuh pada foto rak dan gambar hasilnya (untuk memeriksa kualitas deteksi).

Contoh (dari folder infra):
  .venv\\Scripts\\python scripts\\visualize.py samples -o out
Tiap foto menghasilkan out\\<nama>_hasil.jpg dan out\\<nama>_hasil.json.
Warna: kotak unit = biru (label + posisi U + merek), kabel = oranye, slot U kosong = merah putus-putus.
"""

import argparse
import asyncio
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.clients.knowledge import load_knowledge_cached  # noqa: E402
from app.api.main import cluster_to_dict, unit_to_hardware  # noqa: E402
from app.clients.meta_client import MetaApiError, MetaClient, prepare_image  # noqa: E402
from app.workflows.pipeline import analyze_rack  # noqa: E402

EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def draw(jpeg: bytes, result, hardware: list[dict]) -> Image.Image:
    im = Image.open(io.BytesIO(jpeg)).convert("RGB")
    w, h = im.size
    d = ImageDraw.Draw(im)
    font = ImageFont.load_default(size=max(12, h // 70))

    def box(b):
        return (b[0] * w, b[1] * h, (b[0] + b[2]) * w, (b[1] + b[3]) * h)

    for cl in result.cables:
        for c in cl.cables:
            d.rectangle(box(c.bbox), outline="#f5a524", width=2)
    for slot in result.empty_slots:
        status = slot.get("status", "tidak_diperiksa")
        color, text = {
            "kosong": ("#e5484d", "KOSONG"),
            "terisi": ("#8e4ec6", "ADA ISI (tak terdeteksi)"),
        }.get(status, ("#a0a0a0", "TIDAK JELAS"))
        x0, y0, x1, y1 = box(slot["bbox"])
        for x in range(int(x0), int(x1), 16):  # garis putus-putus
            d.line((x, y0, min(x + 8, x1), y0), fill=color, width=3)
            d.line((x, y1, min(x + 8, x1), y1), fill=color, width=3)
        d.text((x0 + 4, y0 + 4), f"{text} U{slot['u_start']}-U{slot['u_end']}", fill=color, font=font)
    for i, (u, hw) in enumerate(zip(result.units, hardware), 1):
        x0, y0, x1, y1 = box(u.bbox)
        d.rectangle((x0, y0, x1, y1), outline="#0090ff", width=4)
        u_txt = f"U{hw['u_start']}" + (f"-U{hw['u_start'] + hw['u_size'] - 1}" if hw.get("u_size", 1) > 1 else "") if "u_start" in hw else ""
        label = f"#{i} {hw['nama']} {u_txt} {hw['merek']}".strip()
        tw = d.textlength(label, font=font)
        d.rectangle((x0, y0, x0 + tw + 8, y0 + font.size + 6), fill="#0090ff")
        d.text((x0 + 4, y0 + 2), label, fill="white", font=font)
    return im


async def run(images: Path, out: Path, rack_u: int | None) -> None:
    files = sorted(p for p in images.iterdir() if p.suffix.lower() in EXTS)
    if not files:
        sys.exit(f"Tidak ada foto di {images}")
    out.mkdir(parents=True, exist_ok=True)
    client = MetaClient()
    knowledge = load_knowledge_cached(get_settings().knowledge_dir)
    for p in files:
        print(f"\n== {p.name}", flush=True)
        data = p.read_bytes()
        before = dict(client.stats)
        try:
            r = await analyze_rack(client, data, rack_u=rack_u, knowledge=knowledge)
        except MetaApiError as e:
            print(f"  gagal: {e}")
            continue
        positions = r.positions or [None] * len(r.units)
        unc = r.u_uncertain or [False] * len(r.units)
        hardware = [unit_to_hardware(u, pos, q) for u, pos, q in zip(r.units, positions, unc)]
        summary = {
            "image": {"width": r.width, "height": r.height},
            "u_total": r.grid.total_u if r.grid else None,
            "gap_retries": r.retried_gaps,
            "empty_slots": r.empty_slots,
            "hardware": hardware,
            "cables": [cluster_to_dict(c) for c in r.cables],
            "findings": r.findings,
        }
        (out / f"{p.stem}_hasil.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        draw(prepare_image(data)[0], r, hardware).save(out / f"{p.stem}_hasil.jpg", quality=90)
        print(f"  rak {summary['u_total']}U · {len(hardware)} unit · {sum(c.count for c in r.cables)} kabel · "
              f"{len(r.empty_slots)} slot kosong · {len(r.findings)} temuan kabel")
        used = {k: client.stats[k] - before[k] for k in client.stats}
        print(f"  panggilan API: SAM {used['sam']} · Muse {used['muse']} · dari cache {used['cached']}")
        for i, hw in enumerate(hardware, 1):
            u = f"U{hw['u_start']}+{hw['u_size']}" if "u_start" in hw else "-"
            if hw.get("u_uncertain"):
                u += "?"
            print(f"  #{i} {hw['nama']:<14} {u:<8} {hw['merek'] or '(merek tak terbaca)'}  [{hw['confidence']}]")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("images", type=Path)
    ap.add_argument("-o", "--output", type=Path, default=Path("out"))
    ap.add_argument("--rack-u", type=int, default=None)
    args = ap.parse_args()
    asyncio.run(run(args.images, args.output, args.rack_u))


if __name__ == "__main__":
    main()
