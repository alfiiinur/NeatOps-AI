"""Deteksi unit rak: SAM per kelas, lalu bersihkan (NMS, dedup lintas kelas, buang kotak gabungan)."""

from dataclasses import dataclass
from statistics import median

from .geometry import BBox, Detection
from .meta_client import MetaClient

MIN_CONFIDENCE = 0.3
DEDUPE_IOU = 0.6
SIDE_BY_SIDE_RATIO = 1.5  # rentang vertikal anak <= 1,5x anak tertinggi -> berdampingan, bukan bertumpuk
COLUMN_EXEMPT = {"PDU power strip"}


@dataclass(frozen=True)
class UnitClass:
    prompt: str  # frasa untuk SAM
    nama: str  # nama generik untuk frontend
    jenis: str  # kategori frontend (Jaringan, Server, Daya, ...)
    priority: int = 0  # lebih tinggi menang saat dua kelas saling menimpa


UNIT_CLASSES: list[UnitClass] = [
    UnitClass("network switch", "Switch", "Jaringan", 2),
    UnitClass("patch panel", "Patch Panel", "Konektivitas", 2),
    UnitClass("rack server", "Server Rack", "Server", 2),
    UnitClass("router", "Router", "Jaringan", 1),
    UnitClass("firewall appliance", "Firewall", "Keamanan", 1),
    UnitClass("NAS storage", "NAS Rack", "Storage", 1),
    UnitClass("UPS", "UPS", "Daya", 2),
    UnitClass("PDU power strip", "PDU Rack", "Daya", 2),
    UnitClass("KVM switch", "KVM Switch", "Manajemen", 1),
    UnitClass("blanking panel", "Blanking Panel", "Aksesori", 0),
    # Prompt umum: pada foto uji, prompt spesifik di atas sering mengembalikan nol (mis. NVR, UPS tower, perangkat
    # industri), sedangkan frasa umum menemukan hampir semua perangkat. Nama dan jenis akhirnya ditentukan Muse.
    UnitClass("NVR video recorder", "NVR/DVR", "Keamanan", 1),
    UnitClass("equipment", "Perangkat", "Lainnya", -1),
    UnitClass("electronic device", "Perangkat", "Lainnya", -1),
]
CLASS_BY_PROMPT = {c.prompt: c for c in UNIT_CLASSES}


@dataclass
class Unit:
    cls: UnitClass
    bbox: BBox
    confidence: float
    mask: object = None
    ident: object = None  # Identification dari app.identify (diisi setelah deteksi)


def area(b: BBox) -> float:
    return max(0.0, b[2]) * max(0.0, b[3])


def intersection(a: BBox, b: BBox) -> float:
    w = min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0])
    h = min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1])
    return max(0.0, w) * max(0.0, h)


def iou(a: BBox, b: BBox) -> float:
    inter = intersection(a, b)
    union = area(a) + area(b) - inter
    return inter / union if union > 0 else 0.0


def contained_fraction(inner: BBox, outer: BBox) -> float:
    """Berapa bagian luas `inner` yang berada di dalam `outer`."""
    a = area(inner)
    return intersection(inner, outer) / a if a > 0 else 0.0


def _rank(u: Unit) -> tuple[int, float]:
    return (u.cls.priority, u.confidence)


def dedupe(units: list[Unit], iou_threshold: float = DEDUPE_IOU) -> list[Unit]:
    """NMS gabungan: kotak yang tumpang tindih kuat dianggap objek yang sama, simpan yang terbaik.

    Satu fungsi untuk dalam-kelas dan lintas-kelas; prioritas kelas lalu confidence menentukan pemenang.
    """
    kept: list[Unit] = []
    for u in sorted(units, key=_rank, reverse=True):
        if all(iou(u.bbox, k.bbox) < iou_threshold for k in kept):
            kept.append(u)
    return kept


def drop_aggregate_boxes(
    units: list[Unit], inner_fraction: float = 0.8, min_children: int = 2, area_ratio: float = 1.5
) -> list[Unit]:
    """Selesaikan kotak yang membungkus >= `min_children` kotak lain (hampir seluruhnya di dalamnya).

    Bergantung pada susunan anak-anaknya:
    - Bertumpuk vertikal (unit-unit rak berbeda): kotak pembungkus yang salah, dibuang.
    - Berdampingan di baris yang sama (modul dari SATU perangkat, mis. controller modular): pembungkus
      itulah perangkatnya, maka anak-anaknya yang dibuang.
    Pembungkus hanya dihitung bila jauh lebih besar dari tiap anaknya, supaya dua unit yang saling
    bersinggungan tidak ikut terbuang.
    """
    drop: set[int] = set()
    for i, big in enumerate(units):
        children = [
            j
            for j, small in enumerate(units)
            if j != i
            and area(small.bbox) * area_ratio <= area(big.bbox)
            and contained_fraction(small.bbox, big.bbox) >= inner_fraction
        ]
        if len(children) < min_children:
            continue
        tops = [units[j].bbox[1] for j in children]
        bottoms = [units[j].bbox[1] + units[j].bbox[3] for j in children]
        tallest = max(units[j].bbox[3] for j in children)
        side_by_side = (max(bottoms) - min(tops)) <= SIDE_BY_SIDE_RATIO * tallest
        if side_by_side:
            drop.update(children)
        else:
            drop.add(i)
    return [u for i, u in enumerate(units) if i not in drop]


def drop_outside_column(units: list[Unit], min_overlap: float = 0.6) -> list[Unit]:
    """Buang objek di luar kolom rak (monitor, PC, perangkat di samping rak).

    Kolom rak = median tepi kiri/kanan dari separuh kotak terlebar. Unit dipertahankan bila minimal
    `min_overlap` lebarnya berada di dalam kolom. PDU dikecualikan karena letaknya memang di samping.
    Dengan kurang dari 3 unit kolom tidak bisa ditaksir, jadi tidak ada yang dibuang.
    """
    if len(units) < 3:
        return units
    widest = sorted(units, key=lambda u: u.bbox[2], reverse=True)[: max(3, (len(units) + 1) // 2)]
    col_l = median(u.bbox[0] for u in widest)
    col_r = median(u.bbox[0] + u.bbox[2] for u in widest)
    kept = []
    for u in units:
        x0, x1 = u.bbox[0], u.bbox[0] + u.bbox[2]
        overlap = max(0.0, min(x1, col_r) - max(x0, col_l))
        if u.cls.prompt in COLUMN_EXEMPT or (u.bbox[2] > 0 and overlap / u.bbox[2] >= min_overlap):
            kept.append(u)
    return kept


def clean_units(
    units: list[Unit], min_confidence: float = MIN_CONFIDENCE, iou_threshold: float = DEDUPE_IOU
) -> list[Unit]:
    """Saring keyakinan rendah, dedup (NMS), dan buang kotak gabungan. Parameter dituning di scripts/evaluate.py."""
    units = [u for u in units if u.confidence >= min_confidence and area(u.bbox) > 0]
    units = dedupe(units, iou_threshold)
    units = drop_aggregate_boxes(units)
    units = drop_outside_column(units)
    return sorted(units, key=lambda u: (u.bbox[1], u.bbox[0]))  # atas -> bawah


def to_units(by_prompt: dict[str, list[Detection]]) -> list[Unit]:
    out: list[Unit] = []
    for prompt, dets in by_prompt.items():
        cls = CLASS_BY_PROMPT[prompt]
        for d in dets:
            out.append(Unit(cls, d.bbox, d.confidence if d.confidence is not None else 0.5, d.mask))
    return out


async def detect_units(client: MetaClient, image_bytes: bytes) -> list[Unit]:
    by_prompt = await client.segment_many(image_bytes, [c.prompt for c in UNIT_CLASSES])
    return clean_units(to_units(by_prompt))
