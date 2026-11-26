import io

from fastapi.testclient import TestClient
from PIL import Image

from app.common.geometry import Detection
from app.api.main import app, get_meta_client


def jpeg_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (300, 200), "gray").save(buf, format="JPEG")
    return buf.getvalue()


class FakeMeta:
    """Pengganti MetaClient: panggilan pertama (gambar penuh) menemukan 'network switch' dan 'UPS'.
    Panggilan berikutnya (crop celah) tidak menemukan apa pun."""

    def __init__(self):
        self.calls = 0

    async def chat_json(self, **kwargs):
        return {
            "is_rack_equipment": True,
            "jenis": "Jaringan",
            "merek": "Cisco",
            "model": "Catalyst 9200L",
            "tipe": "24-port managed switch",
            "teks_label": "Cisco",
            "confidence": 0.9,
        }

    async def segment_many(self, image_bytes, concepts, prepared=None):
        self.calls += 1
        found = {
            "network switch": [Detection("network switch", (0.1, 0.1, 0.8, 0.1), 0.9)],
            "UPS": [Detection("UPS", (0.1, 0.8, 0.8, 0.15), 0.8)],
        } if self.calls == 1 else {}
        return {c: found.get(c, []) for c in concepts}


def make_client(meta=None):
    meta = meta or FakeMeta()
    app.dependency_overrides[get_meta_client] = lambda: meta
    return TestClient(app)


def teardown_function():
    app.dependency_overrides.clear()


def test_analyze_returns_hardware_in_frontend_format():
    r = make_client().post("/analyze", files={"photo": ("rak.jpg", jpeg_bytes(), "image/jpeg")})
    assert r.status_code == 200
    body = r.json()
    assert body["image"] == {"width": 300, "height": 200}
    assert [h["nama"] for h in body["hardware"]] == ["Switch", "UPS"]  # atas -> bawah
    hw = body["hardware"][0]
    assert set(hw) >= {"nama", "merek", "jenis", "tipe", "jumlah", "bbox"}
    assert hw["jenis"] == "Jaringan" and len(hw["bbox"]) == 4
    assert hw["merek"] == "Cisco Catalyst 9200L" and hw["tipe"] == "24-port managed switch"
    assert body["rack"]["u_total"] >= 2
    assert hw["u_start"] > body["hardware"][1]["u_start"]  # switch di atas UPS, U1 di dasar
    assert body["rack"]["empty_slots"]  # celah di antara switch dan UPS dilaporkan kosong


def test_analyze_rack_u_param_overrides_estimate():
    r = make_client().post(
        "/analyze?rack_u=12", files={"photo": ("rak.jpg", jpeg_bytes(), "image/jpeg")}
    )
    assert r.status_code == 200
    assert r.json()["rack"]["u_total"] == 12


def test_analyze_rejects_non_image():
    r = make_client().post("/analyze", files={"photo": ("x.txt", b"bukan gambar", "text/plain")})
    assert r.status_code == 400


def test_analyze_reports_u_estimated_and_u_uncertain_fields():
    files = {"photo": ("rak.jpg", jpeg_bytes(), "image/jpeg")}
    body = make_client().post("/analyze", files=files).json()
    assert body["rack"]["u_estimated"] is True
    assert all(isinstance(h["u_uncertain"], bool) for h in body["hardware"])

    fixed = make_client().post("/analyze?rack_u=12", files=files).json()
    assert fixed["rack"]["u_estimated"] is False


def test_analyze_sends_rack_geometry_ids_and_snapped_boxes():
    body = make_client().post("/analyze", files={"photo": ("rak.jpg", jpeg_bytes(), "image/jpeg")}).json()
    rack = body["rack"]
    for key in ("u_h", "top", "bottom", "x0", "x1"):
        assert isinstance(rack[key], float), key
    assert rack["bottom"] > rack["top"] and rack["x1"] > rack["x0"]
    assert [h["id"] for h in body["hardware"]] == ["hw-1", "hw-2"]
    for h in body["hardware"]:
        assert h["bbox_source"] == "detected"
        x, y, w, hh = h["bbox"]
        assert rack["x0"] - 1e-3 <= x and x + w <= rack["x1"] + 1e-3
        assert rack["top"] - 1e-3 <= y and y + hh <= rack["bottom"] + 1e-3
        if not h["u_uncertain"]:  # bbox rata dengan garis U
            assert (y - rack["top"]) / rack["u_h"] == __import__("pytest").approx(
                round((y - rack["top"]) / rack["u_h"]), abs=0.05
            )


class EmptyMeta(FakeMeta):
    """Foto tanpa rak (mis. orang/ruangan): SAM tidak menemukan apa pun."""

    async def segment_many(self, image_bytes, concepts, prepared=None):
        return {c: [] for c in concepts}


class GenericOnlyMeta(FakeMeta):
    """Hanya tebakan generik (layar/baju) dan tidak ada kabinet rak."""

    async def segment_many(self, image_bytes, concepts, prepared=None):
        found = {
            "equipment": [Detection("equipment", (0.2, 0.2, 0.5, 0.2), 0.8), Detection("equipment", (0.2, 0.5, 0.5, 0.2), 0.8)]
        }
        return {c: found.get(c, []) for c in concepts}


def test_analyze_flags_photo_without_rack():
    body = make_client(EmptyMeta()).post("/analyze", files={"photo": ("orang.jpg", jpeg_bytes(), "image/jpeg")}).json()
    assert body["rack_detected"] is False and body["hardware"] == []


def test_analyze_flags_generic_only_detections_without_rack_cabinet():
    body = make_client(GenericOnlyMeta()).post("/analyze", files={"photo": ("ruang.jpg", jpeg_bytes(), "image/jpeg")}).json()
    assert body["rack_detected"] is False


def test_analyze_flags_real_rack_as_detected():
    body = make_client().post("/analyze", files={"photo": ("rak.jpg", jpeg_bytes(), "image/jpeg")}).json()
    assert body["rack_detected"] is True
