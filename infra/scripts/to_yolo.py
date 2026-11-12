"""Ubah export JSON Label Studio (anotasi yang sudah dikoreksi) menjadi dataset YOLO.

Contoh (dari folder infra):
  .venv\\Scripts\\python scripts\\to_yolo.py export.json --images samples -o dataset
Di Label Studio: Export -> JSON (bukan JSON-MIN).
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.labeling import convert_export_to_yolo  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("export", type=Path, help="file export JSON dari Label Studio")
    ap.add_argument("--images", type=Path, required=True, help="folder foto asli")
    ap.add_argument("-o", "--output", type=Path, default=Path("dataset"))
    ap.add_argument("--val-ratio", type=float, default=0.2)
    ap.add_argument(
        "--include-predictions",
        action="store_true",
        help="pakai prediksi untuk task yang belum dianotasi (TIDAK disarankan: belum dikoreksi manusia)",
    )
    args = ap.parse_args()

    tasks = json.loads(args.export.read_text(encoding="utf-8"))
    r = convert_export_to_yolo(tasks, args.images, args.output, args.val_ratio, args.include_predictions)

    print(f"Gambar: {r.images} (train {r.train}, val {r.val}) · kotak: {r.boxes}")
    for name, n in sorted(r.per_class.items()):
        print(f"  {name}: {n}")
    if r.unannotated_tasks:
        print(f"Dilewati, belum dianotasi: {r.unannotated_tasks} task")
    if r.missing_images:
        print(f"Foto tidak ditemukan di {args.images}: {', '.join(r.missing_images)}")
    if r.skipped_labels:
        print(f"Kotak dilewati (label tak dikenal/berotasi/tak valid): {dict(r.skipped_labels)}")
    print(f"Dataset: {args.output / 'data.yaml'}")


if __name__ == "__main__":
    main()
