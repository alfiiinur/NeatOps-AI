"""Buat pra-label untuk Label Studio dari folder foto rak.

Contoh (dari folder infra):
  .venv\\Scripts\\python scripts\\prelabel.py samples -o labeling
Hasil: labeling\\tasks.json (impor ke Label Studio) dan labeling\\labeling_config.xml (tempel ke Labeling Interface).

Agar gambar tampil di Label Studio, aktifkan local files serving sebelum menjalankannya:
  set LABEL_STUDIO_LOCAL_FILES_SERVING_ENABLED=true
  set LABEL_STUDIO_LOCAL_FILES_DOCUMENT_ROOT=<path lengkap folder infra>
  label-studio start
lalu tambahkan Local Files storage yang menunjuk ke folder foto (mis. samples).
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageOps  # noqa: E402

from app.labeling import label_config, task_from_analysis  # noqa: E402
from app.meta_client import MetaApiError, MetaClient  # noqa: E402
from app.pipeline import analyze_rack  # noqa: E402

EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def display_size(path: Path) -> tuple[int, int]:
    """Ukuran gambar sebagaimana ditampilkan browser (orientasi EXIF diterapkan)."""
    with Image.open(path) as im:
        return ImageOps.exif_transpose(im).size


async def run(images_dir: Path, out_dir: Path, url_prefix: str, rack_u: int | None) -> None:
    files = sorted(p for p in images_dir.iterdir() if p.suffix.lower() in EXTS)
    if not files:
        sys.exit(f"Tidak ada foto (.jpg/.png/.webp) di {images_dir}")
    client = MetaClient()
    tasks = []
    for p in files:
        print(f"Menganalisis {p.name} ...", flush=True)
        try:
            # identify=False: pra-label hanya butuh kotak, tidak perlu biaya Muse per unit.
            analysis = await analyze_rack(client, p.read_bytes(), rack_u=rack_u, identify=False)
        except MetaApiError as e:
            print(f"  dilewati: {e}")
            continue
        tasks.append(task_from_analysis(f"{url_prefix}{p.name}", analysis, size=display_size(p)))
        n = len(tasks[-1]["predictions"][0]["result"])
        print(f"  {len(analysis.units)} unit, {sum(c.count for c in analysis.cables)} kabel -> {n} kotak")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "tasks.json").write_text(json.dumps(tasks, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "labeling_config.xml").write_text(label_config(), encoding="utf-8")
    print(f"Selesai: {len(tasks)} task -> {out_dir / 'tasks.json'}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("images", type=Path, help="folder foto rak")
    ap.add_argument("-o", "--output", type=Path, default=Path("labeling"))
    ap.add_argument(
        "--url-prefix",
        default="/data/local-files/?d=samples/",
        help="awalan URL gambar di Label Studio (default untuk foto di infra/samples dengan local files serving)",
    )
    ap.add_argument("--rack-u", type=int, default=None, help="total U rak bila diketahui")
    args = ap.parse_args()
    asyncio.run(run(args.images, args.output, args.url_prefix, args.rack_u))


if __name__ == "__main__":
    main()
