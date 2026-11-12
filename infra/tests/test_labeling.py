import copy
import io
import json
import xml.etree.ElementTree as ET

import pytest
from PIL import Image

from app.vision.cables import Cable, CableCluster
from app.vision.detect import CLASS_BY_PROMPT, Unit
from app.workflows.labeling import (
    CLASS_ID,
    LABEL_CLASSES,
    convert_export_to_yolo,
    image_basename,
    is_val,
    label_config,
    rect_result,
    task_from_analysis,
    yolo_line,
)
from app.workflows.pipeline import RackAnalysis

SWITCH = CLASS_BY_PROMPT["network switch"]
UPS = CLASS_BY_PROMPT["UPS"]


def analysis():
    units = [Unit(SWITCH, (0.1, 0.1, 0.8, 0.1), 0.9), Unit(UPS, (0.1, 0.8, 0.8, 0.15), 0.8)]
    cl = CableCluster((0.3, 0.2, 0.1, 0.5), [Cable("data", (0.3, 0.2, 0.05, 0.4), 0.7), Cable("daya", (0.35, 0.3, 0.05, 0.4), 0.6)])
    return RackAnalysis(800, 1000, units, None, cables=[cl])


def to_annotated(task):
    """Simulasikan annotator yang menerima semua prediksi apa adanya."""
    t = copy.deepcopy(task)
    t["annotations"] = [{"was_cancelled": False, "result": t["predictions"][0]["result"]}]
    return t


def write_image(path, size=(80, 100)):
    Image.new("RGB", size, "gray").save(path, format="JPEG")


def test_label_classes_unique_and_config_is_valid_xml_with_all_labels():
    assert len(LABEL_CLASSES) == len(set(LABEL_CLASSES))
    root = ET.fromstring(label_config())
    values = [e.get("value") for e in root.iter("Label")]
    assert values == LABEL_CLASSES
    assert root.find("RectangleLabels").get("name") == "label"


def test_rect_result_uses_percent_and_clips_to_image():
    r = rect_result("a", "Switch", (0.1, 0.2, 0.5, 0.25), 800, 1000, 0.9)
    v = r["value"]
    assert (v["x"], v["y"], v["width"], v["height"]) == (10.0, 20.0, 50.0, 25.0)
    assert r["original_width"] == 800 and r["original_height"] == 1000 and r["score"] == 0.9
    clipped = rect_result("b", "Switch", (0.9, 0.9, 0.5, 0.5), 10, 10, None)
    assert clipped["value"]["width"] == pytest.approx(10.0) and "score" not in clipped
    assert rect_result("c", "Switch", (1.2, 0.1, 0.1, 0.1), 10, 10, None) is None  # di luar gambar


def test_task_has_units_and_individual_cables_with_correct_labels():
    task = task_from_analysis("/data/local-files/?d=samples/rak.jpg", analysis())
    pred = task["predictions"][0]
    labels = [r["value"]["rectanglelabels"][0] for r in pred["result"]]
    assert labels == ["Switch", "UPS", "Kabel Data", "Kabel Daya"]
    assert len({r["id"] for r in pred["result"]}) == 4
    assert pred["score"] == pytest.approx((0.9 + 0.8 + 0.7 + 0.6) / 4, abs=1e-3)
    json.dumps(task)  # harus bisa diserialisasi untuk tasks.json


def test_task_size_override_is_used_for_original_dimensions():
    task = task_from_analysis("x.jpg", analysis(), size=(3000, 4000))
    assert task["predictions"][0]["result"][0]["original_width"] == 3000


def test_yolo_line_converts_percent_to_normalized_center_format():
    line = yolo_line("UPS", {"x": 10.0, "y": 80.0, "width": 80.0, "height": 15.0, "rotation": 0})
    cls, cx, cy, w, h = line.split()
    assert int(cls) == CLASS_ID["UPS"]
    assert (float(cx), float(cy), float(w), float(h)) == pytest.approx((0.5, 0.875, 0.8, 0.15))


def test_yolo_line_rejects_unknown_label_rotation_and_empty_boxes():
    ok = {"x": 1, "y": 1, "width": 5, "height": 5, "rotation": 0}
    assert yolo_line("Bukan Kelas", ok) is None
    assert yolo_line("Switch", {**ok, "rotation": 15}) is None
    assert yolo_line("Switch", {**ok, "width": 0}) is None
    assert yolo_line("Switch", {"x": 120, "y": 0, "width": 5, "height": 5, "rotation": 0}) is None


@pytest.mark.parametrize(
    "ref",
    ["/data/local-files/?d=samples/rak%201.jpg", "http://host/static/rak 1.jpg?x=1", "rak 1.jpg", "/data/upload/3/rak%201.jpg"],
)
def test_image_basename_handles_label_studio_url_forms(ref):
    assert image_basename(ref) == "rak 1.jpg"


def test_roundtrip_prelabel_to_yolo_preserves_boxes(tmp_path):
    images = tmp_path / "samples"
    images.mkdir()
    write_image(images / "rak1.jpg")
    task = to_annotated(task_from_analysis("/data/local-files/?d=samples/rak1.jpg", analysis()))

    report = convert_export_to_yolo([task], images, tmp_path / "ds")

    assert report.images == 1 and report.boxes == 4
    assert report.per_class["Kabel Data"] == 1
    label_files = list((tmp_path / "ds" / "labels").rglob("rak1.txt"))
    assert label_files, "label harus ditulis"
    lines = label_files[0].read_text().strip().splitlines()
    first = lines[0].split()  # Switch (0.1,0.1,0.8,0.1) -> cx 0.5, cy 0.15
    assert int(first[0]) == CLASS_ID["Switch"]
    assert [float(v) for v in first[1:]] == pytest.approx([0.5, 0.15, 0.8, 0.1], abs=1e-4)
    assert list((tmp_path / "ds" / "images").rglob("rak1.jpg")), "gambar harus disalin ke dataset"


def test_data_yaml_lists_all_classes_in_id_order(tmp_path):
    images = tmp_path / "im"
    images.mkdir()
    write_image(images / "a.jpg")
    convert_export_to_yolo([to_annotated(task_from_analysis("a.jpg", analysis()))], images, tmp_path / "ds")
    text = (tmp_path / "ds" / "data.yaml").read_text(encoding="utf-8")
    assert "train: images/train" in text and "val: images/val" in text
    for i, name in enumerate(LABEL_CLASSES):
        assert f"  {i}: {name}" in text


def test_unannotated_cancelled_and_missing_are_reported_not_used(tmp_path):
    images = tmp_path / "im"
    images.mkdir()
    write_image(images / "ok.jpg")
    base = task_from_analysis("ok.jpg", analysis())
    unannotated = copy.deepcopy(base)  # hanya prediksi
    cancelled = copy.deepcopy(base)
    cancelled["annotations"] = [{"was_cancelled": True, "result": base["predictions"][0]["result"]}]
    missing = to_annotated(task_from_analysis("hilang.jpg", analysis()))

    r = convert_export_to_yolo([unannotated, cancelled, missing], images, tmp_path / "ds")

    assert r.images == 0
    assert r.unannotated_tasks == 2
    assert r.missing_images == ["hilang.jpg"]


def test_include_predictions_flag_uses_unreviewed_boxes(tmp_path):
    images = tmp_path / "im"
    images.mkdir()
    write_image(images / "ok.jpg")
    pred_only = task_from_analysis("ok.jpg", analysis())
    r = convert_export_to_yolo([pred_only], images, tmp_path / "ds", include_predictions=True)
    assert r.images == 1 and r.boxes == 4


def test_latest_annotation_wins_and_human_deletions_are_respected(tmp_path):
    images = tmp_path / "im"
    images.mkdir()
    write_image(images / "ok.jpg")
    t = to_annotated(task_from_analysis("ok.jpg", analysis()))
    kept = t["annotations"][0]["result"][:1]  # annotator menghapus 3 kotak
    t["annotations"].append({"was_cancelled": False, "result": kept})
    r = convert_export_to_yolo([t], images, tmp_path / "ds")
    assert r.boxes == 1


def test_empty_annotation_is_a_valid_negative_example(tmp_path):
    images = tmp_path / "im"
    images.mkdir()
    write_image(images / "kosong.jpg")
    t = {"data": {"image": "kosong.jpg"}, "annotations": [{"was_cancelled": False, "result": []}]}
    r = convert_export_to_yolo([t], images, tmp_path / "ds")
    assert r.images == 1 and r.boxes == 0
    label = next((tmp_path / "ds" / "labels").rglob("kosong.txt"))
    assert label.read_text() == ""


def test_unknown_labels_are_counted_as_skipped(tmp_path):
    images = tmp_path / "im"
    images.mkdir()
    write_image(images / "a.jpg")
    t = to_annotated(task_from_analysis("a.jpg", analysis()))
    t["annotations"][0]["result"][0]["value"]["rectanglelabels"] = ["Salah Ketik"]
    r = convert_export_to_yolo([t], images, tmp_path / "ds")
    assert r.skipped_labels["Salah Ketik"] == 1 and r.boxes == 3


def test_split_is_deterministic_and_both_sets_nonempty_with_two_images(tmp_path):
    images = tmp_path / "im"
    images.mkdir()
    tasks = []
    for name in ("a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"):
        write_image(images / name)
        tasks.append(to_annotated(task_from_analysis(name, analysis())))
    r1 = convert_export_to_yolo(tasks, images, tmp_path / "ds1")
    r2 = convert_export_to_yolo(tasks, images, tmp_path / "ds2")
    assert (r1.train, r1.val) == (r2.train, r2.val)
    assert r1.train >= 1 and r1.val >= 1 and r1.train + r1.val == 5
    assert is_val("a", 0.2) == is_val("a", 0.2)


def test_two_images_always_get_one_train_and_one_val(tmp_path):
    images = tmp_path / "im"
    images.mkdir()
    tasks = []
    for name in ("x.jpg", "y.jpg"):
        write_image(images / name)
        tasks.append(to_annotated(task_from_analysis(name, analysis())))
    for ratio in (0.0, 1.0):
        r = convert_export_to_yolo(tasks, images, tmp_path / f"ds{ratio}", val_ratio=ratio)
        assert (r.train, r.val) == (1, 1)


def test_single_image_is_copied_to_val_too(tmp_path):
    images = tmp_path / "im"
    images.mkdir()
    write_image(images / "solo.jpg")
    r = convert_export_to_yolo([to_annotated(task_from_analysis("solo.jpg", analysis()))], images, tmp_path / "ds")
    assert r.images == 1
    assert list((tmp_path / "ds" / "images" / "val").glob("solo.jpg")) and list((tmp_path / "ds" / "labels" / "val").glob("solo.txt"))
