import io

import cv2
import numpy as np
import pytest
from PIL import Image

from app.common.geometry import Detection
from app.vision.detect import CLASS_BY_PROMPT, Unit
from app.vision.rack import build_grid, dedupe_by_grid
from app.vision.rectify import estimate_rectification, map_box_back, warp_jpeg
from app.workflows.pipeline import analyze_rack

W = H = 1000

# Rak tampak depan (piksel) dan sudutnya pada foto miring: sisi kiri/kanan menyatu ke atas (foto dari bawah).
FRONT = np.float32([[300, 100], [700, 100], [300, 900], [700, 900]])
SKEWED = np.float32([[300, 100], [650, 150], [200, 900], [750, 850]])
H_TRUE = cv2.getPerspectiveTransform(FRONT, SKEWED)


def skewed_unit_boxes(n=5):
    """bbox (ternormalisasi) tiap unit setelah perspektif: n baris setinggi sama di tampak depan."""
    boxes = []
    for i in range(n):
        y0, y1 = 100 + i * 800 / n, 100 + (i + 1) * 800 / n
        quad = np.float32([[[300, y0], [700, y0], [300, y1], [700, y1]]])
        pts = cv2.perspectiveTransform(quad, H_TRUE)[0]
        x0, y0b, x1, y1b = pts[:, 0].min(), pts[:, 1].min(), pts[:, 0].max(), pts[:, 1].max()
        boxes.append((x0 / W, y0b / H, (x1 - x0) / W, (y1b - y0b) / H))
    return boxes


def test_straight_rack_needs_no_rectification():
    boxes = [(0.2, 0.1 + i * 0.15, 0.6, 0.14) for i in range(5)]
    assert estimate_rectification(boxes, W, H) is None


def test_too_few_units_or_vertical_spread_gives_none():
    assert estimate_rectification(skewed_unit_boxes()[:2], W, H) is None
    tight = [(0.2 + 0.02 * i, 0.5, 0.6, 0.02) for i in range(4)]
    assert estimate_rectification(tight, W, H) is None


def test_skewed_rack_is_estimated_and_rows_become_even():
    boxes = skewed_unit_boxes()
    rect = estimate_rectification(boxes, W, H)
    assert rect is not None and rect.skew > 0.04

    def centre_ys(transform):
        out = []
        for x, y, w, h in boxes:
            c = np.float32([[[(x + w / 2) * W, (y + h / 2) * H]]])
            out.append(transform(c)[0][0][1])
        return np.array(out)

    before = np.diff(centre_ys(lambda c: c))
    after = np.diff(centre_ys(lambda c: cv2.perspectiveTransform(c, rect.matrix)))
    cv = lambda a: float(np.std(a) / np.mean(a))  # noqa: E731
    assert cv(after) < cv(before)


def test_map_box_back_roundtrips_a_rectified_box():
    rect = estimate_rectification(skewed_unit_boxes(), W, H)
    rw, rh = rect.size
    # Kotak di gambar lurus -> foto asli -> kembali ke gambar lurus harus jatuh di dalam kotak asal (bounding box).
    box = (0.2, 0.3, 0.5, 0.1)
    back = map_box_back(box, rect)
    assert 0 <= back[0] and back[0] + back[2] <= 1 and 0 <= back[1] and back[1] + back[3] <= 1
    assert back[2] > 0 and back[3] > 0
    corners = np.float32([[[back[0] * W, back[1] * H], [(back[0] + back[2]) * W, (back[1] + back[3]) * H]]])
    fwd = cv2.perspectiveTransform(corners, rect.matrix)[0]
    assert fwd[:, 0].min() / rw < box[0] + 0.25 and fwd[:, 0].max() / rw > box[0] + box[2] - 0.25


def test_warp_jpeg_has_requested_size():
    rect = estimate_rectification(skewed_unit_boxes(), W, H)
    buf = io.BytesIO()
    Image.new("RGB", (W, H), "gray").save(buf, format="JPEG")
    out = Image.open(io.BytesIO(warp_jpeg(buf.getvalue(), rect)))
    assert out.size == rect.size


# ── dedup berbasis grid U ───────────────────────────────────────────────────────────────────────────
SWITCH = CLASS_BY_PROMPT["network switch"]
GENERIC = CLASS_BY_PROMPT["equipment"]
UNIT = 0.8 * (44.45 / 482.6)  # tinggi 1U untuk panel selebar 0.8, gambar persegi


def u(cls, x, slot, w=0.8, conf=0.9, size=1):
    return Unit(cls, (x, 0.1 + slot * UNIT, w, size * UNIT), conf)


def grid_of(units):
    return build_grid([x.bbox for x in units], W, H)


def test_dedupe_merges_two_boxes_on_same_u_keeps_best():
    a, b = u(SWITCH, 0.1, 0), u(GENERIC, 0.12, 0, w=0.78, conf=0.95)
    c = u(SWITCH, 0.1, 2)
    units = [a, b, c]
    out = dedupe_by_grid(units, grid_of(units))
    assert out == [a, c]  # kelas spesifik menang walau keyakinan lebih rendah


def test_dedupe_keeps_side_by_side_devices_on_same_u():
    left, right = u(SWITCH, 0.1, 0, w=0.38), u(SWITCH, 0.55, 0, w=0.35)
    far = u(SWITCH, 0.1, 3)
    units = [left, right, far]
    assert dedupe_by_grid(units, grid_of(units)) == units


def test_dedupe_leaves_different_u_untouched_and_order_stable():
    units = [u(SWITCH, 0.1, i) for i in range(4)]
    assert dedupe_by_grid(units, grid_of(units)) == units


# ── jalur pipeline dengan rectification ────────────────────────────────────────────────────────────
class Scripted:
    """Panggilan 1 = rencana (foto asli); panggilan 2 = analisis penuh pada gambar lurus; sisanya kosong."""

    def __init__(self, plan, straight):
        self.plan, self.straight, self.calls, self.sizes = plan, straight, 0, []

    async def segment_many(self, image_bytes, concepts, prepared=None):
        self.calls += 1
        self.sizes.append(Image.open(io.BytesIO(image_bytes)).size)
        found = self.plan if self.calls == 1 else (self.straight if self.calls == 2 else {})
        return {c: found.get(c, []) for c in concepts}


def jpeg():
    buf = io.BytesIO()
    Image.new("RGB", (W, H), "gray").save(buf, format="JPEG")
    return buf.getvalue()


async def test_pipeline_rectifies_skewed_photo_and_maps_boxes_back():
    skew = skewed_unit_boxes()
    plan = {"network switch": [Detection("network switch", b, 0.9) for b in skew]}
    rect = estimate_rectification(skew, W, H)
    rw, rh = rect.size
    # Pada gambar lurus, rak = persegi panjang selebar 400 px dengan 5 unit 1U (44,45/482,6 x lebar) bertumpuk.
    pad = 0.04 * 400
    u_px = 400 * 44.45 / 482.6
    straight_boxes = [(pad / rw, (pad + i * u_px) / rh, 400 / rw, u_px / rh) for i in range(5)]
    straight = {"network switch": [Detection("network switch", b, 0.9) for b in straight_boxes]}

    meta = Scripted(plan, straight)
    r = await analyze_rack(meta, jpeg(), identify=False, rectify=True)

    assert (r.width, r.height) == (W, H)  # koordinat kembali ke foto asli
    assert meta.sizes[1] == rect.size  # analisis penuh memakai gambar lurus
    assert len(r.units) == 5 and r.grid.total_u == 5
    assert [p[0] for p in r.positions] == [5, 4, 3, 2, 1]
    # Box unit = box pada gambar lurus yang dipetakan kembali ke foto asli.
    for got, sb in zip(sorted(r.units, key=lambda x: x.bbox[1]), straight_boxes):
        assert got.bbox == pytest.approx(map_box_back(sb, rect), abs=1e-6)
    assert len(r.boxes) == 5 and all(0 <= b[0] <= 1 and 0 <= b[1] <= 1 for b in r.boxes)
    assert all(type(v) is float for b in r.boxes for v in b)  # bisa di-serialisasi JSON


async def test_pipeline_without_flag_or_on_straight_rack_uses_plain_path():
    straight_rack = {"network switch": [Detection("network switch", (0.2, 0.1 + i * 0.15, 0.6, 0.14), 0.9) for i in range(4)]}
    meta = Scripted(straight_rack, straight_rack)
    r = await analyze_rack(meta, jpeg(), identify=False, rectify=True)  # sudah lurus: hanya jalur biasa
    assert meta.sizes[0] == meta.sizes[1] == (W, H) and len(r.units) == 4

    meta2 = Scripted({}, {})
    await analyze_rack(meta2, jpeg(), identify=False)  # rectify mati: tanpa panggilan rencana
    assert meta2.calls == 1


async def test_pipeline_falls_back_when_straightened_image_finds_fewer_units():
    skew = skewed_unit_boxes()
    plan = {"network switch": [Detection("network switch", b, 0.9) for b in skew]}
    straight = {"network switch": [Detection("network switch", (0.1, 0.1, 0.8, 0.1), 0.9)]}  # hanya 1 unit
    meta = Scripted(plan, straight)
    r = await analyze_rack(meta, jpeg(), identify=False, rectify=True)
    assert len(r.units) == 0 or (r.width, r.height) == (W, H)
    assert meta.sizes[-1] == (W, H)  # jalur biasa dijalankan lagi pada foto asli
