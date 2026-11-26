"""Render overlay PNG untuk review visual (golden): kotak hardware H#, slot kosong, dan temuan dari hasil deteksi.

Contoh (dari folder infra):
  .venv\\Scripts\\python scripts\\render_overlay.py samples out -o out\\golden
Memakai out\\<nama>_hasil.json (keluaran visualize.py atau respons /analyze) + samples\\<nama>.<ext>.
Warna: hardware = biru (H#), temuan = oranye (#n), slot kosong = merah putus-putus.
"""

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def _box(b, w, h):
    return (b[0] * w, b[1] * h, (b[0] + b[2]) * w, (b[1] + b[3]) * h)


def _tag(d, xy, text, fill, font):
    tw = d.textlength(text, font=font)
    d.rectangle((xy[0], xy[1], xy[0] + tw + 8, xy[1] + font.size + 6), fill=fill)
    d.text((xy[0] + 4, xy[1] + 2), text, fill="white", font=font)


def render(image: Path, summary: dict, out: Path) -> None:
    im = Image.open(image).convert("RGB")
    w, h = im.size
    d = ImageDraw.Draw(im)
    font = ImageFont.load_default(size=max(12, h // 70))

    for s in summary.get("empty_slots") or (summary.get("rack") or {}).get("empty_slots", []):
        x0, y0, x1, y1 = _box(s["bbox"], w, h)
        d.rectangle((x0, y0, x1, y1), outline="#e5484d", width=2)
        _tag(d, (x0, y0), f"KOSONG U{s['u_start']}-U{s['u_end']}", "#e5484d", font)
    for i, hw in enumerate(summary.get("hardware", []), 1):
        x0, y0, x1, y1 = _box(hw["bbox"], w, h)
        d.rectangle((x0, y0, x1, y1), outline="#0090ff", width=4)
        _tag(d, (x0, y0), f"H{i} {hw['nama']}", "#0090ff", font)
    for n, f in enumerate(summary.get("findings", []), 1):
        if not f.get("bbox"):
            continue
        x0, y0, x1, y1 = _box(f["bbox"], w, h)
        d.rectangle((x0, y0, x1, y1), outline="#f5a524", width=3)
        _tag(d, (x1 - 60, y1 - font.size - 8), f"#{n} {f['id']}", "#c77700", font)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, format="PNG")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("samples", type=Path)
    ap.add_argument("results", type=Path)
    ap.add_argument("-o", "--output", type=Path, default=Path("out/golden"))
    args = ap.parse_args()
    photos = {p.stem: p for p in args.samples.iterdir() if p.suffix.lower() in EXTS}
    done = 0
    for js in sorted(args.results.glob("*_hasil.json")):
        stem = js.name[: -len("_hasil.json")]
        if stem not in photos:
            print(f"lewati {js.name}: foto {stem} tidak ada di {args.samples}")
            continue
        render(photos[stem], json.loads(js.read_text(encoding="utf-8")), args.output / f"{stem}_overlay.png")
        done += 1
        print(f"ok {stem}")
    if not done:
        sys.exit("Tidak ada overlay yang dibuat")


if __name__ == "__main__":
    main()
