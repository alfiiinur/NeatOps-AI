import pytest

from app.evaluation import (
    AGNOSTIC,
    Box,
    cable_preds,
    dets_to_raw,
    evaluate,
    gt_from_task,
    match_image,
    overall,
    split_gt,
    sweep,
    unit_preds,
    yolo_readiness,
)
from app.geometry import Detection
from app.labeling import LABEL_CLASSES, rect_result

A = (0.1, 0.1, 0.8, 0.1)
B = (0.1, 0.3, 0.8, 0.1)


def test_perfect_match():
    s = match_image([Box("Switch", A, 0.9)], [Box("Switch", A)])
    assert (s["Switch"].tp, s["Switch"].fp, s["Switch"].fn) == (1, 0, 0)
    assert s["Switch"].precision == s["Switch"].recall == s["Switch"].f1 == 1.0
    assert s["Switch"].mean_iou == pytest.approx(1.0)


def test_missed_and_spurious_boxes_counted():
    s = match_image([Box("Switch", A, 0.9), Box("Switch", (0.1, 0.8, 0.8, 0.1), 0.8)], [Box("Switch", A), Box("Switch", B)])
    sw = s["Switch"]
    assert (sw.tp, sw.fp, sw.fn) == (1, 1, 1)
    assert sw.precision == 0.5 and sw.recall == 0.5 and sw.f1 == 0.5


def test_iou_threshold_is_respected():
    shifted = (0.1, 0.105, 0.8, 0.1)  # IoU ~0.9
    assert match_image([Box("S", shifted)], [Box("S", A)], 0.5)["S"].tp == 1
    far = (0.1, 0.15, 0.8, 0.1)  # IoU = 1/3
    s = match_image([Box("S", far)], [Box("S", A)], 0.5)["S"]
    assert (s.tp, s.fp, s.fn) == (0, 1, 1)


def test_wrong_class_is_fp_and_fn_but_fine_for_localization_only():
    pred, gt = [Box("Server Rack", A, 0.9)], [Box("Switch", A)]
    strict = match_image(pred, gt)
    assert strict["Server Rack"].fp == 1 and strict["Switch"].fn == 1
    loose = match_image(pred, gt, ignore_label=True)
    assert set(loose) == {AGNOSTIC} and loose[AGNOSTIC].tp == 1


def test_one_gt_matches_only_one_prediction_highest_score_first():
    dup_low, dup_high = Box("S", A, 0.4), Box("S", (0.1, 0.101, 0.8, 0.1), 0.9)
    s = match_image([dup_low, dup_high], [Box("S", A)])["S"]
    assert (s.tp, s.fp, s.fn) == (1, 1, 0)


def test_evaluate_aggregates_images_and_overall_is_micro():
    pairs = [
        ([Box("Switch", A, 0.9)], [Box("Switch", A)]),
        ([], [Box("Switch", A), Box("UPS", B)]),
    ]
    per = evaluate(pairs)
    assert (per["Switch"].tp, per["Switch"].fn) == (1, 1)
    assert per["UPS"].fn == 1
    o = overall(per)
    assert (o.tp, o.fp, o.fn) == (1, 0, 2)


def test_no_division_by_zero_on_empty_inputs():
    s = overall(evaluate([([], [])]))
    assert s.precision == s.recall == s.f1 == s.mean_iou == 0.0


def test_gt_from_task_reads_latest_human_annotation_in_normalized_coords():
    r = rect_result("a", "Switch", A, 800, 1000, None)
    task = {"data": {"image": "x.jpg"}, "annotations": [{"was_cancelled": False, "result": [r]}]}
    gt = gt_from_task(task)
    assert gt == [Box("Switch", pytest.approx(A))]
    assert gt_from_task({"data": {}, "predictions": [{"result": [r]}]}) is None  # prediksi bukan GT
    assert gt_from_task({"data": {}, "annotations": [{"was_cancelled": True, "result": [r]}]}) is None


def test_split_gt_separates_units_and_cables():
    units, cables = split_gt([Box("Switch", A), Box("Kabel Data", B), Box("Bundel Kabel", B)])
    assert [b.label for b in units] == ["Switch"] and len(cables) == 2


def raw(*dets):
    by_prompt = {}
    for prompt, bbox, conf in dets:
        by_prompt.setdefault(prompt, []).append(Detection(prompt, bbox, conf))
    return dets_to_raw(by_prompt)


def test_unit_preds_apply_threshold_and_nms_overrides():
    r = raw(("network switch", A, 0.9), ("network switch", (0.1, 0.102, 0.8, 0.1), 0.4), ("UPS", B, 0.35))
    default = unit_preds(r)
    assert sorted(b.label for b in default) == ["Switch", "UPS"]  # duplikat Switch dibuang NMS
    strict = unit_preds(r, min_conf=0.5)
    assert [b.label for b in strict] == ["Switch"]  # UPS (0.35) tersaring
    loose_nms = unit_preds(r, iou_thr=0.99)
    assert len([b for b in loose_nms if b.label == "Switch"]) == 2  # NMS terlalu longgar -> duplikat tersisa


def test_cable_preds_use_cable_labels():
    r = raw(("network cable", (0.3, 0.1, 0.05, 0.4), 0.8), ("power cable", (0.5, 0.1, 0.05, 0.4), 0.7))
    assert sorted(b.label for b in cable_preds(r)) == ["Kabel Data", "Kabel Daya"]


def test_sweep_ranks_settings_and_finds_better_threshold():
    # Foto: 1 switch asli (conf 0.9) + 1 deteksi palsu berkeyakinan rendah (0.35) di tempat kosong.
    r = raw(("network switch", A, 0.9), ("network switch", (0.1, 0.7, 0.8, 0.1), 0.35))
    rows = sweep([r], [[Box("Switch", A)]], min_confs=(0.3, 0.5), iou_thrs=(0.6,))
    assert rows[0]["min_confidence"] == 0.5
    assert rows[0]["loc_f1"] == 1.0
    assert rows[1]["loc_precision"] == 0.5


def test_yolo_readiness_tiers():
    few = yolo_readiness(10, {"Switch": 20})
    assert few["tier"] == "belum"
    trial = yolo_readiness(120, {"Switch": 400, "UPS": 150, "Router": 0})
    assert trial["tier"] == "uji-coba" and trial["weakest_class_instances"] == 150
    assert trial["classes_without_data"] == ["Router"]
    done = yolo_readiness(3000, {c: 12000 for c in LABEL_CLASSES})
    assert done["tier"] == "memadai"
    assert yolo_readiness(200, {})["tier"] == "belum"
