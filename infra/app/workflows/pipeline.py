"""Orkestrasi analisis rak: deteksi unit, grid U, ulangi deteksi di celah, hasilkan posisi U."""

import asyncio
from dataclasses import dataclass, field

from ..vision.cables import CABLE_PROMPTS, CableCluster, assess_clusters, cluster_cables, link_units, to_cables
from ..vision.detect import UNIT_CLASSES, Unit, clean_units, drop_attached_fragments, drop_nested, to_units
from ..vision.findings import build_cable_findings
from ..common.geometry import BBox, Detection
from ..vision.identify import classify_slots, identify_units, is_shelf_like
from ..common.imaging import crop_region, map_box_from_crop
from ..clients.meta_client import MAX_SIDE, MetaClient, prepare_image
from ..vision.rack import RackGrid, build_grid, find_gaps, gap_to_slot, locate, u_uncertain

RACK_PROMPT = "server rack cabinet"
MAX_GAP_RETRIES = 6
GAP_PAD_U = 0.5  # konteks tambahan (dalam U) di atas/bawah celah saat dicrop
MIN_RETRY_WIDTH_RATIO = 0.5
# Retry celah cukup memakai prompt umum (2 panggilan, bukan semua kelas): pada foto uji prompt umum menemukan
# hampir semua perangkat, dan nama/jenis akhirnya ditentukan Muse.
GAP_RETRY_PROMPTS = ["equipment", "electronic device"]
MIN_RETRY_GAP_U = 0.75  # celah lebih rendah dari ini tidak muat perangkat; jangan buang panggilan


@dataclass
class RackAnalysis:
    width: int
    height: int
    units: list[Unit]
    grid: RackGrid | None
    positions: list[tuple[int, int]] = field(default_factory=list)  # (u_start, u_size) sejajar dengan units
    u_uncertain: list[bool] = field(default_factory=list)  # sejajar dengan units: posisi U tidak dapat dipercaya
    u_estimated: bool = True  # True bila total U ditaksir dari gambar (rack_u tidak diberikan pengguna)
    empty_slots: list[dict] = field(default_factory=list)
    retried_gaps: int = 0
    cables: list[CableCluster] = field(default_factory=list)
    findings: list[dict] = field(default_factory=list)


def _best_rack_box(dets: list[Detection]) -> BBox | None:
    dets = [d for d in dets if (d.confidence or 0) >= 0.3]
    if not dets:
        return None
    best = max(dets, key=lambda d: d.bbox[2] * d.bbox[3] * (d.confidence or 0.5))
    return best.bbox


def _prompts() -> list[str]:
    return [c.prompt for c in UNIT_CLASSES]


async def _retry_gap(
    client: MetaClient, jpeg: bytes, grid: RackGrid, gap: tuple[float, float]
) -> list[Unit]:
    pad = GAP_PAD_U * grid.u_h
    y0, y1 = max(0.0, gap[0] - pad), min(1.0, gap[1] + pad)
    # Selalu selebar gambar penuh: membatasi ke lebar unit yang sudah terdeteksi memotong perangkat yang lebih
    # lebar (ditemukan pada foto uji). Objek di luar kolom rak disaring kemudian oleh clean_units.
    region: BBox = (0.0, y0, 1.0, y1 - y0)
    crop, used = crop_region(jpeg, region)
    by_prompt = await client.segment_many(crop, GAP_RETRY_PROMPTS)
    units = to_units(by_prompt)
    for u in units:
        u.bbox = map_box_from_crop(u.bbox, used)
        u.mask = None  # mask hasil crop tidak sebangun dengan koordinat gambar penuh
    # Perangkat rack menempati lebar panel; objek yang jauh lebih sempit di celah biasanya bingkai/kabel.
    return [u for u in units if u.bbox[2] >= MIN_RETRY_WIDTH_RATIO * grid.ref_width]


async def analyze_rack(
    client: MetaClient,
    image_bytes: bytes,
    rack_u: int | None = None,
    *,
    identify: bool = True,
    knowledge: list[str] | None = None,
) -> RackAnalysis:
    max_side = getattr(getattr(client, "settings", None), "max_image_side", MAX_SIDE)
    prepared = prepare_image(image_bytes, max_side)
    jpeg, width, height = prepared

    by_prompt = await client.segment_many(
        jpeg, [*_prompts(), RACK_PROMPT, *CABLE_PROMPTS], prepared=prepared
    )
    rack_box = _best_rack_box(by_prompt.pop(RACK_PROMPT, []))
    cable_dets = {p: by_prompt.pop(p, []) for p in CABLE_PROMPTS}
    units = clean_units(to_units(by_prompt))
    clusters = cluster_cables(to_cables(cable_dets))

    grid = build_grid([u.bbox for u in units], width, height, rack_bbox=rack_box, rack_u=rack_u)
    if grid is None:
        return RackAnalysis(width, height, units, None, cables=clusters)

    # Pass kedua: ulangi deteksi pada crop di tiap celah supaya unit kecil/redup tidak terlewat.
    gaps = find_gaps([u.bbox for u in units], grid)
    retried = 0
    retryable = [g for g in gaps if g[1] - g[0] >= MIN_RETRY_GAP_U * grid.u_h]
    for gap in retryable[:MAX_GAP_RETRIES]:
        units = clean_units(units + await _retry_gap(client, jpeg, grid, gap))
        retried += 1

    # Identifikasi merek/model; unit yang jelas bukan perangkat rack dibuang sebelum grid final dihitung.
    if identify:
        units = await identify_units(client, jpeg, units, knowledge or [])
        # Setelah Muse menamai tiap unit baru terlihat mana pembungkus shelf (dipertahankan isinya) dan mana
        # perangkat yang mendapat sub-bagian bersarang (dibuang).
        units = drop_nested(units, protect=is_shelf_like)
        units = drop_attached_fragments(units)

    # Hitung ulang grid dengan unit baru (lebar referensi bisa berubah), lalu celah yang tersisa = slot kosong.
    grid = build_grid([u.bbox for u in units], width, height, rack_bbox=rack_box, rack_u=rack_u) or grid
    remaining = find_gaps([u.bbox for u in units], grid)
    positions = [locate(u.bbox, grid) for u in units]
    uncertain = [u_uncertain(u.bbox, grid) for u in units]

    # Kabel: hubungkan ke unit, nilai kerapian/label lewat Muse, lalu turunkan temuan.
    link_units(clusters, units)
    empty_slots = [gap_to_slot(g, grid) for g in remaining]
    if identify:
        # Celah belum tentu kosong (cable manager, panel penuh kabel, perangkat tak terdeteksi): verifikasi dulu.
        await asyncio.gather(
            assess_clusters(client, jpeg, clusters),
            classify_slots(client, jpeg, empty_slots, min_height=0.95 * grid.u_h),  # toleransi 5%: celah tepat 1U jangan terlewat
        )
    return RackAnalysis(
        width,
        height,
        units,
        grid,
        positions=positions,
        u_uncertain=uncertain,
        u_estimated=rack_u is None,
        empty_slots=empty_slots,
        retried_gaps=retried,
        cables=clusters,
        findings=build_cable_findings(clusters, units, positions),
    )
