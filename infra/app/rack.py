"""Grid U rak: estimasi tinggi 1U dari lebar panel 19", posisi U tiap unit, dan celah yang belum terdeteksi.

Penggaris: panel depan perangkat rack standar selebar 19" (482,6 mm), 1U setinggi 44,45 mm.
Semua koordinat ternormalisasi terhadap gambar; lebar/tinggi piksel dipakai agar rasio aspek benar.
Penomoran U mengikuti konvensi rak: U1 di paling bawah.
"""

from dataclasses import dataclass
from statistics import median

from .geometry import BBox

U_MM = 44.45
PANEL_MM = 482.6
MIN_COVERAGE_WIDTH = 0.5  # unit lebih sempit dari 50% lebar referensi (mis. PDU vertikal) tidak menutup slot
MIN_GAP_U = 0.6  # celah lebih pendek dari 0,6U diabaikan (bingkai, bayangan, sambungan)
MAX_TOTAL_U = 60


@dataclass(frozen=True)
class RackGrid:
    top: float  # y ternormalisasi tepi atas area rak
    bottom: float
    u_h: float  # tinggi 1U (ternormalisasi terhadap tinggi gambar)
    total_u: int
    ref_width: float  # lebar referensi 19" (ternormalisasi terhadap lebar gambar)
    x0: float  # tepi kiri/kanan area rak (ternormalisasi)
    x1: float


def reference_width(boxes: list[BBox]) -> float | None:
    """Lebar panel 19": median lebar kotak yang termasuk kelompok terlebar (>= 80% dari yang terlebar)."""
    widths = [b[2] for b in boxes if b[2] > 0]
    if not widths:
        return None
    widest = max(widths)
    return median([w for w in widths if w >= 0.8 * widest])


def build_grid(
    boxes: list[BBox],
    img_w: int,
    img_h: int,
    rack_bbox: BBox | None = None,
    rack_u: int | None = None,
) -> RackGrid | None:
    if not boxes:
        return None
    ref_w = reference_width(boxes)
    units_top = min(b[1] for b in boxes)
    units_bottom = max(b[1] + b[3] for b in boxes)
    x0 = min(b[0] for b in boxes)
    x1 = max(b[0] + b[2] for b in boxes)

    top, bottom = units_top, units_bottom
    if rack_bbox is not None:
        rt, rb = rack_bbox[1], rack_bbox[1] + rack_bbox[3]
        overlap = max(0.0, min(rb, units_bottom) - max(rt, units_top))
        # Kotak rak dipakai hanya bila benar-benar membungkus unit-unit (bukan objek lain).
        if units_bottom > units_top and overlap / (units_bottom - units_top) >= 0.8:
            top, bottom = min(rt, units_top), max(rb, units_bottom)
            x0, x1 = min(rack_bbox[0], x0), max(rack_bbox[0] + rack_bbox[2], x1)

    if rack_u:
        u_h = (bottom - top) / rack_u
        total = rack_u
    else:
        u_px = ref_w * img_w * U_MM / PANEL_MM
        u_h = u_px / img_h
        total = max(1, min(MAX_TOTAL_U, round((bottom - top) / u_h)))
    return RackGrid(top, bottom, u_h, total, ref_w, x0, x1)


def locate(bbox: BBox, grid: RackGrid) -> tuple[int, int]:
    """(u_start, u_size) untuk sebuah unit. u_start = nomor U terbawah yang ditempati (U1 di dasar)."""
    u_size = max(1, round(bbox[3] / grid.u_h))
    top_index = round((bbox[1] - grid.top) / grid.u_h)  # 0 = slot teratas
    u_start = grid.total_u - (top_index + u_size) + 1
    u_start = max(1, min(grid.total_u - u_size + 1, u_start))
    return u_start, u_size


def find_gaps(boxes: list[BBox], grid: RackGrid, min_u: float = MIN_GAP_U) -> list[tuple[float, float]]:
    """Rentang y (y0, y1) di area rak yang tidak tertutup unit mana pun, minimal `min_u` tinggi."""
    spans = sorted(
        (b[1], b[1] + b[3]) for b in boxes if b[2] >= MIN_COVERAGE_WIDTH * grid.ref_width
    )
    gaps: list[tuple[float, float]] = []
    cursor = grid.top
    for s, e in spans:
        if s - cursor >= min_u * grid.u_h:
            gaps.append((cursor, s))
        cursor = max(cursor, e)
    if grid.bottom - cursor >= min_u * grid.u_h:
        gaps.append((cursor, grid.bottom))
    return gaps


def gap_to_slot(gap: tuple[float, float], grid: RackGrid) -> dict:
    """Ubah celah y menjadi rentang U kosong + bbox."""
    y0, y1 = gap
    size = max(1, round((y1 - y0) / grid.u_h))
    u_start, size = locate((0, y0, 0, size * grid.u_h), grid)
    return {
        "u_start": u_start,
        "u_end": u_start + size - 1,
        "bbox": [round(grid.x0, 4), round(y0, 4), round(grid.x1 - grid.x0, 4), round(y1 - y0, 4)],
    }
