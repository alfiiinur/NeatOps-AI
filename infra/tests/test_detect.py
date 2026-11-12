from app.vision.detect import (
    CLASS_BY_PROMPT,
    Unit,
    clean_units,
    dedupe,
    drop_aggregate_boxes,
    iou,
)

SWITCH = CLASS_BY_PROMPT["network switch"]
SERVER = CLASS_BY_PROMPT["rack server"]
BLANK = CLASS_BY_PROMPT["blanking panel"]


def u(cls, y, h, conf=0.9, x=0.1, w=0.8):
    return Unit(cls, (x, y, w, h), conf)


def test_iou_basic():
    assert iou((0, 0, 1, 1), (0, 0, 1, 1)) == 1.0
    assert iou((0, 0, 0.5, 0.5), (0.5, 0.5, 0.5, 0.5)) == 0.0


def test_dedupe_same_object_found_by_two_classes_keeps_higher_priority():
    a = u(SWITCH, 0.10, 0.05, conf=0.7)
    b = u(BLANK, 0.101, 0.05, conf=0.95)  # kelas prioritas rendah walau confidence lebih tinggi
    kept = dedupe([a, b])
    assert kept == [a]


def test_stacked_units_are_not_merged():
    # Dua unit bertumpuk rapat: IoU kecil, keduanya harus bertahan.
    kept = dedupe([u(SWITCH, 0.10, 0.05), u(SERVER, 0.15, 0.05)])
    assert len(kept) == 2


def test_big_box_covering_many_units_is_dropped():
    big = u(SERVER, 0.05, 0.60, conf=0.99)
    kids = [u(SWITCH, 0.08 + i * 0.12, 0.08) for i in range(4)]
    out = drop_aggregate_boxes([big, *kids])
    assert big not in out
    assert all(k in out for k in kids)


def test_large_server_with_single_child_is_kept():
    server = u(SERVER, 0.10, 0.20)
    small = u(BLANK, 0.12, 0.05)
    out = drop_aggregate_boxes([server, small])
    assert server in out and small in out


def test_clean_units_filters_low_confidence_and_sorts_top_to_bottom():
    low = u(SWITCH, 0.5, 0.05, conf=0.1)
    lower = u(SERVER, 0.6, 0.05)
    upper = u(SWITCH, 0.1, 0.05)
    out = clean_units([lower, low, upper])
    assert out == [upper, lower]


# ─── Perilaku baru dari uji foto nyata ─────────────────────────────────────

from app.vision.detect import drop_outside_column  # noqa: E402

PDU = CLASS_BY_PROMPT["PDU power strip"]
GENERIC = CLASS_BY_PROMPT["equipment"]


def test_side_by_side_modules_keep_wrapper_and_drop_children():
    # Satu perangkat modular (mis. controller 7 modul): pembungkus ADALAH perangkatnya.
    wrapper = Unit(GENERIC, (0.18, 0.22, 0.55, 0.15), 0.9)
    modules = [Unit(GENERIC, (0.18 + i * 0.075, 0.22, 0.07, 0.15), 0.8) for i in range(7)]
    out = drop_aggregate_boxes([wrapper, *modules])
    assert out == [wrapper]


def test_stacked_children_still_drop_wrapper():
    big = Unit(SERVER, (0.1, 0.05, 0.8, 0.6), 0.99)
    kids = [Unit(SWITCH, (0.1, 0.08 + i * 0.12, 0.8, 0.08), 0.9) for i in range(4)]
    assert big not in drop_aggregate_boxes([big, *kids])


def test_objects_outside_rack_column_are_dropped():
    rack = [Unit(SWITCH, (0.25, 0.1 + i * 0.1, 0.5, 0.08), 0.9) for i in range(5)]
    monitor_left = Unit(GENERIC, (0.0, 0.6, 0.15, 0.2), 0.9)
    monitor_right = Unit(GENERIC, (0.8, 0.4, 0.2, 0.3), 0.9)
    out = drop_outside_column([*rack, monitor_left, monitor_right])
    assert monitor_left not in out and monitor_right not in out
    assert all(r in out for r in rack)


def test_narrow_device_inside_column_is_kept():
    rack = [Unit(SWITCH, (0.25, 0.1 + i * 0.1, 0.5, 0.08), 0.9) for i in range(4)]
    small = Unit(GENERIC, (0.35, 0.7, 0.15, 0.05), 0.8)  # mis. switch kecil di atas shelf
    assert small in drop_outside_column([*rack, small])


def test_pdu_beside_units_is_exempt_from_column_filter():
    rack = [Unit(SWITCH, (0.25, 0.1 + i * 0.1, 0.5, 0.08), 0.9) for i in range(4)]
    pdu = Unit(PDU, (0.85, 0.1, 0.05, 0.6), 0.8)
    assert pdu in drop_outside_column([*rack, pdu])


def test_column_filter_needs_at_least_three_units():
    two = [Unit(SWITCH, (0.25, 0.1, 0.5, 0.08), 0.9), Unit(GENERIC, (0.9, 0.5, 0.05, 0.05), 0.9)]
    assert drop_outside_column(two) == two


def test_generic_prompt_loses_to_specific_class_on_same_object():
    generic = Unit(GENERIC, A_BOX := (0.1, 0.1, 0.8, 0.1), 0.95)
    specific = Unit(SWITCH, A_BOX, 0.6)
    assert dedupe([generic, specific]) == [specific]


# ─── Dedup kontainmen (duplikat Pakscan, kotak bersarang) ──────────────────

from app.vision.detect import drop_contained_duplicates, drop_nested  # noqa: E402


def test_near_duplicate_inside_larger_box_is_dropped_even_with_low_iou():
    big = Unit(GENERIC, (0.1, 0.1, 0.6, 0.2), 0.9)
    dup = Unit(GENERIC, (0.12, 0.12, 0.5, 0.16), 0.7)  # di dalam big, luas 67% -> objek yang sama
    assert iou(big.bbox, dup.bbox) < 0.8
    assert drop_contained_duplicates([big, dup]) == [big]
    assert clean_units([dup, big]) == [big]


def test_contained_duplicate_keeps_the_higher_ranked_box():
    big = Unit(GENERIC, (0.1, 0.1, 0.6, 0.2), 0.5)
    inner = Unit(SWITCH, (0.12, 0.12, 0.5, 0.16), 0.9)  # kelas spesifik menang walau lebih kecil
    assert drop_contained_duplicates([big, inner]) == [inner]


def test_small_contained_box_is_not_a_duplicate():
    big = Unit(GENERIC, (0.1, 0.1, 0.6, 0.2), 0.9)
    small = Unit(GENERIC, (0.15, 0.12, 0.1, 0.05), 0.8)  # luas ~4% -> bukan duplikat
    assert len(drop_contained_duplicates([big, small])) == 2


def test_adjacent_units_are_not_duplicates():
    a, b = u(SWITCH, 0.10, 0.05), u(SERVER, 0.15, 0.05)
    assert drop_contained_duplicates([a, b]) == [a, b]


def test_modules_inside_wrapper_are_left_to_aggregate_rule():
    wrapper = Unit(GENERIC, (0.18, 0.22, 0.55, 0.15), 0.9)
    modules = [Unit(GENERIC, (0.18 + i * 0.275, 0.22, 0.27, 0.15), 0.8) for i in range(2)]  # 2 modul ~49% luas
    assert len(drop_contained_duplicates([wrapper, *modules])) == 3
    assert drop_aggregate_boxes([wrapper, *modules]) == [wrapper]


def test_single_nested_small_box_is_dropped():
    device = Unit(SWITCH, (0.1, 0.1, 0.6, 0.2), 0.9)
    nested = Unit(GENERIC, (0.2, 0.15, 0.1, 0.05), 0.6)
    assert drop_nested([device, nested]) == [device]


def test_device_on_shelf_is_kept_when_wrapper_is_protected():
    shelf = Unit(GENERIC, (0.1, 0.1, 0.6, 0.2), 0.9)
    on_shelf = Unit(GENERIC, (0.2, 0.15, 0.1, 0.05), 0.6)
    assert drop_nested([shelf, on_shelf], protect=lambda b: b is shelf) == [shelf, on_shelf]


def test_nested_more_confident_than_wrapper_is_kept():
    device = Unit(SWITCH, (0.1, 0.1, 0.6, 0.2), 0.5)
    nested = Unit(GENERIC, (0.2, 0.15, 0.1, 0.05), 0.9)
    assert len(drop_nested([device, nested])) == 2


def test_wrapper_with_several_children_is_not_touched_by_nested_rule():
    wrapper = Unit(GENERIC, (0.1, 0.1, 0.6, 0.2), 0.9)
    kids = [Unit(GENERIC, (0.12 + i * 0.15, 0.15, 0.1, 0.05), 0.6) for i in range(3)]
    assert len(drop_nested([wrapper, *kids])) == 4


# ─── Fragmen menempel (modul samping controller yang terdeteksi dua kali) ────

from app.vision.detect import drop_attached_fragments  # noqa: E402
from app.vision.identify import Identification  # noqa: E402


def with_ident(unit, **kw):
    unit.ident = Identification(**kw)
    return unit


def test_anonymous_generic_strip_beside_a_device_is_dropped():
    host = with_ident(Unit(GENERIC, (0.575, 0.22, 0.155, 0.15), 0.94), nama="Controller", merek="Rotork")
    strip = with_ident(Unit(GENERIC, (0.528, 0.22, 0.049, 0.145), 0.91), nama="Perangkat")
    assert drop_attached_fragments([host, strip]) == [host]


def test_branded_neighbour_is_kept():
    a = with_ident(Unit(SWITCH, (0.1, 0.2, 0.3, 0.1), 0.9), merek="TP-Link")
    b = with_ident(Unit(GENERIC, (0.41, 0.2, 0.05, 0.1), 0.9), merek="Netgear")
    assert len(drop_attached_fragments([a, b])) == 2


def test_far_or_different_row_neighbour_is_kept():
    host = with_ident(Unit(GENERIC, (0.5, 0.2, 0.3, 0.1), 0.9), nama="X")
    far = with_ident(Unit(GENERIC, (0.1, 0.2, 0.05, 0.1), 0.9), nama="Perangkat")  # jauh di kiri
    other_row = with_ident(Unit(GENERIC, (0.45, 0.5, 0.05, 0.1), 0.9), nama="Perangkat")  # baris lain
    assert len(drop_attached_fragments([host, far, other_row])) == 3


def test_unidentified_unit_is_never_dropped_without_ident():
    host = Unit(GENERIC, (0.575, 0.22, 0.155, 0.15), 0.94)
    strip = Unit(GENERIC, (0.528, 0.22, 0.049, 0.145), 0.91)  # belum diidentifikasi -> jangan disentuh
    assert len(drop_attached_fragments([host, strip])) == 2
