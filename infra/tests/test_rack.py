import pytest

from app.rack import PANEL_MM, U_MM, build_grid, find_gaps, gap_to_slot, locate, reference_width

W = H = 1000
U_NORM = 0.8 * (U_MM / PANEL_MM)  # tinggi 1U ternormalisasi untuk panel selebar 0.8 pada gambar persegi


def unit(slot_from_top, size=1, x=0.1, w=0.8, top=0.1):
    return (x, top + slot_from_top * U_NORM, w, size * U_NORM)


def test_reference_width_ignores_narrow_boxes():
    boxes = [(0.1, 0.1, 0.8, 0.05), (0.1, 0.2, 0.78, 0.05), (0.92, 0.1, 0.05, 0.6)]
    assert reference_width(boxes) == pytest.approx(0.79)


def test_total_u_and_positions_from_geometry():
    # 6 slot berurutan: 1U, 2U, 1U, 1U, 1U = 6U total
    boxes = [unit(0), unit(1, 2), unit(3), unit(4), unit(5)]
    grid = build_grid(boxes, W, H)
    assert grid.total_u == 6
    assert locate(boxes[0], grid) == (6, 1)  # paling atas = U6
    assert locate(boxes[1], grid) == (4, 2)  # menempati U4-U5
    assert locate(boxes[4], grid) == (1, 1)  # paling bawah = U1


def test_rack_u_override_scales_grid():
    boxes = [unit(0, 3), unit(3, 3)]
    grid = build_grid(boxes, W, H, rack_u=12)
    assert grid.total_u == 12
    assert grid.u_h == pytest.approx((boxes[1][1] + boxes[1][3] - boxes[0][1]) / 12)


def test_find_gaps_detects_missing_unit_between_two_units():
    boxes = [unit(0), unit(1), unit(4), unit(5)]  # slot 2-3 kosong (2U terlewat)
    grid = build_grid(boxes, W, H)
    gaps = find_gaps(boxes, grid)
    assert len(gaps) == 1
    slot = gap_to_slot(gaps[0], grid)
    assert (slot["u_start"], slot["u_end"]) == (3, 4)


def test_no_gap_when_stacked_tightly():
    boxes = [unit(i) for i in range(5)]
    grid = build_grid(boxes, W, H)
    assert find_gaps(boxes, grid) == []


def test_vertical_pdu_does_not_hide_gaps():
    pdu = (0.92, 0.1, 0.05, 0.6)  # sempit, tidak menutup slot
    boxes = [unit(0), unit(4), pdu]
    grid = build_grid(boxes, W, H)
    gaps = find_gaps(boxes, grid)
    # PDU memperpanjang area rak ke bawah (celah bawah), tapi celah di antara dua unit tetap terdeteksi.
    middle = [g for g in gaps if g[0] == pytest.approx(boxes[0][1] + boxes[0][3])]
    assert len(middle) == 1
    assert len(gaps) == 2


def test_rack_bbox_adds_empty_space_at_top_and_bottom():
    boxes = [unit(2), unit(3)]
    rack = (0.05, 0.1, 0.9, 6 * U_NORM)  # rak 6U, dua unit di tengah
    grid = build_grid(boxes, W, H, rack_bbox=rack)
    assert grid.total_u == 6
    gaps = find_gaps(boxes, grid)
    assert len(gaps) == 2  # atas dan bawah kosong


def test_unrelated_rack_box_is_ignored():
    boxes = [unit(0), unit(1)]
    far = (0.0, 0.8, 1.0, 0.15)  # tidak membungkus unit
    grid = build_grid(boxes, W, H, rack_bbox=far)
    assert grid.top == pytest.approx(boxes[0][1])
