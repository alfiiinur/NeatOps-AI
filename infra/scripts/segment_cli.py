"""Jalankan SAM pada satu foto dan gambar kotak hasilnya.

Contoh (dari folder infra):
  .venv\\Scripts\\python scripts\\segment_cli.py samples\\rak1.jpg -c "network switch" -c "server" -o out.jpg
"""

import argparse
import asyncio
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageDraw  # noqa: E402

from app.clients.meta_client import MetaClient, prepare_image  # noqa: E402

DEFAULT_CONCEPTS = ["network switch", "server", "patch panel", "UPS", "PDU", "network cable"]
COLORS = ["#e5484d", "#0090ff", "#30a46c", "#f5a524", "#8e4ec6", "#12a594", "#d6409f"]


async def run(image_path: Path, concepts: list[str], out_path: Path) -> None:
    data = image_path.read_bytes()
    jpeg, w, h = prepare_image(data)
    results = await MetaClient().segment_many(data, concepts)

    im = Image.open(io.BytesIO(jpeg)).convert("RGB")
    draw = ImageDraw.Draw(im)
    for i, concept in enumerate(concepts):
        color = COLORS[i % len(COLORS)]
        dets = results[concept]
        print(f"{concept}: {len(dets)} ditemukan")
        for d in dets:
            x, y, bw, bh = d.bbox
            box = (x * w, y * h, (x + bw) * w, (y + bh) * h)
            draw.rectangle(box, outline=color, width=3)
            conf = f" {d.confidence:.2f}" if d.confidence is not None else ""
            draw.text((box[0] + 3, box[1] + 3), f"{concept}{conf}", fill=color)
    im.save(out_path)
    print(f"Disimpan: {out_path}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("image", type=Path)
    ap.add_argument("-c", "--concept", action="append", dest="concepts")
    ap.add_argument("-o", "--output", type=Path, default=Path("segment_out.jpg"))
    args = ap.parse_args()
    asyncio.run(run(args.image, args.concepts or DEFAULT_CONCEPTS, args.output))


if __name__ == "__main__":
    main()
