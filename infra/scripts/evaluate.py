"""Ukur akurasi deteksi terhadap foto yang sudah kamu koreksi di Label Studio.

Langkah:
  1. Koreksi pra-label di Label Studio, lalu Export -> JSON (bukan JSON-MIN).
  2. Dari folder infra:
       .venv\\Scripts\\python scripts\\evaluate.py export.json --images samples
Panggilan API (SAM) hanya dilakukan sekali per foto dan disimpan di eval_cache\\; menyetel ambang
(--sweep) memakai cache itu sehingga tidak memakai kredit lagi. Gunakan --refresh untuk mengulang.

Yang dievaluasi: tahap deteksi SAM + pembersihan (NMS, buang kotak gabungan). Pengulangan di celah (tiling)
dan identifikasi merek oleh Muse tidak ikut dinilai oleh skrip ini.
"""

import argparse
import asyncio
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.cables import CABLE_PROMPTS  # noqa: E402
from app.detect import CLASS_BY_PROMPT, DEDUPE_IOU, MIN_CONFIDENCE  # noqa: E402
from app.evaluation import (  # noqa: E402
    cable_preds,
    dets_to_raw,
    evaluate,
    gt_from_task,
    overall,
    split_gt,
    sweep,
    unit_preds,
    yolo_readiness,
)
from app.labeling import LABEL_CLASSES, image_basename  # noqa: E402
from app.meta_client import MetaApiError, MetaClient, prepare_image  # noqa: E402

PROMPTS = [*CLASS_BY_PROMPT, *CABLE_PROMPTS]


async def get_raw(client: MetaClient, image: Path, cache_dir: Path, refresh: bool) -> dict | None:
    cache = cache_dir / f"{image.stem}.json"
    if cache.exists() and not refresh:
        return json.loads(cache.read_text(encoding="utf-8"))
    print(f"  memanggil SAM untuk {image.name} ...", flush=True)
    try:
        prepared = prepare_image(image.read_bytes())
        raw = dets_to_raw(await client.segment_many(prepared[0], PROMPTS, prepared=prepared))
    except MetaApiError as e:
        print(f"  dilewati {image.name}: {e}")
        return None
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(raw), encoding="utf-8")
    return raw


def fmt_row(name: str, s) -> str:
    return f"  {name:<18} P {s.precision:5.2f}  R {s.recall:5.2f}  F1 {s.f1:5.2f}  IoU {s.mean_iou:4.2f}  (TP {s.tp} FP {s.fp} FN {s.fn})"


async def main_async(args) -> None:
    tasks = json.loads(args.export.read_text(encoding="utf-8"))
    items = []  # (nama gambar, raw, gt)
    skipped = 0
    client = None
    for t in tasks:
        gt = gt_from_task(t)
        if gt is None:
            skipped += 1
            continue
        name = image_basename(t.get("data", {}).get("image", ""))
        path = args.images / name
        if not path.is_file():
            print(f"  foto tidak ditemukan: {name}")
            continue
        if args.refresh or not (args.cache / f"{path.stem}.json").exists():
            client = client or MetaClient()  # klien (dan API key) hanya diperlukan bila ada foto tanpa cache
        raw = await get_raw(client, path, args.cache, args.refresh)
        if raw is not None:
            items.append((name, raw, gt))

    if not items:
        sys.exit("Tidak ada foto beranotasi yang bisa dievaluasi.")
    print(f"\nDievaluasi: {len(items)} foto (belum dianotasi: {skipped}) · IoU cocok {args.iou}")

    unit_gts = [split_gt(g)[0] for _, _, g in items]
    cable_gts = [split_gt(g)[1] for _, _, g in items]
    pairs_u = [(unit_preds(raw), g) for (_, raw, _), g in zip(items, unit_gts)]
    pairs_c = [(cable_preds(raw), g) for (_, raw, _), g in zip(items, cable_gts)]

    print(f"\nUNIT (min_confidence {MIN_CONFIDENCE}, NMS IoU {DEDUPE_IOU})")
    per_class = evaluate(pairs_u, args.iou)
    for name in sorted(per_class):
        print(fmt_row(name, per_class[name]))
    print(fmt_row("SEMUA (sesuai kelas)", overall(per_class)))
    print(fmt_row("SEMUA (lokalisasi)", overall(evaluate(pairs_u, args.iou, ignore_label=True))))
    print("  lokalisasi = abaikan label; selisih dengan baris 'sesuai kelas' = salah kelas, bukan kotak meleset")

    if any(cable_gts):
        print("\nKABEL (indikatif: pelabelan kabel per-kabel sangat subjektif)")
        for name, s in sorted(evaluate(pairs_c, args.iou).items()):
            print(fmt_row(name, s))
    else:
        print("\nKABEL: tidak ada anotasi kabel pada foto ini, dilewati.")

    print("\nFoto dengan unit terlewat terbanyak (FN lokalisasi):")
    worst = sorted(
        ((sum(s.fn for s in evaluate([p], args.iou, ignore_label=True).values()), n) for p, (n, _, _) in zip(pairs_u, items)),
        reverse=True,
    )[:5]
    for fn, name in worst:
        if fn:
            print(f"  {name}: {fn} unit terlewat")

    if args.sweep:
        print("\nSWEEP ambang (urut F1 lokalisasi unit):")
        rows = sweep([r for _, r, _ in items], [g for _, _, g in items], match_iou=args.iou)
        print("  min_conf  nms_iou   P     R    F1(lok)  F1(kelas)  meanIoU")
        for r in rows[:8]:
            print(
                f"  {r['min_confidence']:<8}  {r['nms_iou']:<7}  {r['loc_precision']:.2f}  {r['loc_recall']:.2f}  "
                f"{r['loc_f1']:.2f}     {r['cls_f1']:.2f}       {r['mean_iou']:.2f}"
            )
        best = rows[0]
        print(f"  terbaik: min_confidence={best['min_confidence']}, nms_iou={best['nms_iou']} "
              "(ubah MIN_CONFIDENCE / DEDUPE_IOU di app/detect.py bila selisihnya berarti; jangan menyetel dari <10 foto)")

    counts = Counter(b.label for _, _, g in items for b in g)
    ready = yolo_readiness(len(items), {c: counts.get(c, 0) for c in LABEL_CLASSES})
    print(f"\nKESIAPAN YOLO: {ready['tier'].upper()} · {ready['images']} foto · kelas terlemah {ready['weakest_class_instances']} instance")
    print(f"  {ready['note']}")
    if ready["classes_without_data"]:
        print(f"  Kelas tanpa data: {', '.join(ready['classes_without_data'])}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("export", type=Path, help="export JSON Label Studio (anotasi yang sudah dikoreksi)")
    ap.add_argument("--images", type=Path, required=True)
    ap.add_argument("--cache", type=Path, default=Path("eval_cache"))
    ap.add_argument("--iou", type=float, default=0.5, help="ambang IoU untuk dianggap cocok")
    ap.add_argument("--sweep", action="store_true", help="coba kombinasi ambang keyakinan & NMS")
    ap.add_argument("--refresh", action="store_true", help="panggil ulang SAM walau cache ada")
    asyncio.run(main_async(ap.parse_args()))


if __name__ == "__main__":
    main()
