import io
import json
from types import SimpleNamespace

from PIL import Image

from app.core.config import Settings
from app.vision.detect import CLASS_BY_PROMPT, Unit
from app.vision.identify import Identification, identify_units
from app.clients.meta_client import MetaClient

SWITCH = CLASS_BY_PROMPT["network switch"]


def jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (400, 400), "gray").save(buf, format="JPEG")
    return buf.getvalue()


def chat_response(payload) -> SimpleNamespace:
    content = payload if isinstance(payload, str) else json.dumps(payload)
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


class FakeChat:
    """Mengembalikan respons berurutan; item Exception akan dilempar."""

    def __init__(self, replies):
        self.replies, self.calls = list(replies), []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        r = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        if isinstance(r, Exception):
            raise r
        return chat_response(r)


def make_client(replies) -> tuple[MetaClient, FakeChat]:
    chat = FakeChat(replies)
    fake = SimpleNamespace(chat=SimpleNamespace(completions=chat))
    mc = MetaClient(settings=Settings(_env_file=None), client=fake)
    mc.retry_delay = 0
    return mc, chat


GOOD = {
    "is_rack_equipment": True,
    "jenis": "Jaringan",
    "merek": "Cisco",
    "model": "Catalyst 9200L",
    "tipe": "24-port managed switch",
    "teks_label": "Cisco Catalyst 9200L",
    "confidence": 0.92,
}


def unit(y=0.1):
    return Unit(SWITCH, (0.1, y, 0.8, 0.1), 0.9)


async def test_chat_json_sends_schema_image_and_parses():
    mc, chat = make_client([GOOD])
    data = await mc.chat_json(
        system="s", user_text="u", image_jpeg=jpeg(), schema_name="X", schema={"type": "object"}
    )
    assert data["merek"] == "Cisco"
    call = chat.calls[0]
    assert call["response_format"]["type"] == "json_schema"
    assert call["response_format"]["json_schema"]["name"] == "X"
    assert call["messages"][1]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")


async def test_chat_json_retries_on_bad_json_then_succeeds():
    mc, chat = make_client(["bukan json", GOOD])
    data = await mc.chat_json(
        system="s", user_text="u", image_jpeg=jpeg(), schema_name="X", schema={}
    )
    assert data["model"] == "Catalyst 9200L"
    assert len(chat.calls) == 2


async def test_identify_units_fills_ident_and_uses_document_context():
    mc, chat = make_client([GOOD])
    u = unit()
    out = await identify_units(mc, jpeg(), [u], ["Switch: Cisco Catalyst 9200L 24 port"])
    assert out == [u]
    assert isinstance(u.ident, Identification) and u.ident.merek == "Cisco"
    user_text = chat.calls[0]["messages"][1]["content"][0]["text"]
    assert "Catalyst 9200L" in user_text  # konteks dokumen ikut dikirim


async def test_identify_failure_keeps_unit_with_empty_identification():
    mc, _ = make_client([ConnectionError("down")])
    u = unit()
    out = await identify_units(mc, jpeg(), [u], [])
    assert out == [u]
    assert u.ident.merek == "" and u.ident.confidence == 0.0


async def test_invalid_schema_values_fall_back_without_crashing():
    mc, _ = make_client([{"is_rack_equipment": "bukan boolean"}])
    u = unit()
    out = await identify_units(mc, jpeg(), [u], [])
    assert out == [u] and u.ident.merek == ""


async def test_confident_non_equipment_is_dropped_but_unsure_is_kept():
    not_equip = {**GOOD, "is_rack_equipment": False, "confidence": 0.9}
    unsure = {**GOOD, "is_rack_equipment": False, "confidence": 0.4}
    mc, _ = make_client([not_equip, unsure])
    a, b = unit(0.1), unit(0.5)
    out = await identify_units(mc, jpeg(), [a, b], [])
    assert out == [b]


def test_confidence_is_clamped():
    assert Identification(confidence=7).confidence == 1.0
    assert Identification(confidence=-2).confidence == 0.0


# ─── Verifikasi slot kosong ────────────────────────────────────────────────

from app.vision.identify import classify_slots  # noqa: E402


def slots():
    return [
        {"u_start": 5, "u_end": 6, "bbox": [0.1, 0.4, 0.8, 0.1]},
        {"u_start": 1, "u_end": 1, "bbox": [0.1, 0.8, 0.8, 0.05]},
    ]


async def test_classify_slots_marks_empty_filled_and_unclear():
    mc, chat = make_client([{"isi": "kosong", "catatan": ""}, {"isi": "perangkat", "catatan": "cable manager"}])
    s = slots()
    await classify_slots(mc, jpeg(), s)
    assert [x["status"] for x in s] == ["kosong", "terisi"]
    assert chat.calls[0]["messages"][1]["content"][0]["text"].find("U5 to U6") >= 0


async def test_classify_slots_failure_is_never_reported_as_empty():
    mc, _ = make_client([ConnectionError("down")])
    s = slots()
    await classify_slots(mc, jpeg(), s)
    assert [x["status"] for x in s] == ["tidak_jelas", "tidak_jelas"]


async def test_classify_slots_unknown_answer_is_unclear():
    mc, _ = make_client([{"isi": "entah", "catatan": ""}])
    s = slots()
    await classify_slots(mc, jpeg(), s)
    assert all(x["status"] == "tidak_jelas" for x in s)


async def test_identification_name_field_is_parsed():
    mc, _ = make_client([{**GOOD, "nama": "Switch 24-port"}])
    u = unit()
    await identify_units(mc, jpeg(), [u], [])
    assert u.ident.nama == "Switch 24-port"


async def test_classify_slots_skips_slots_below_min_height_without_calling_model():
    mc, chat = make_client([{"isi": "kosong", "catatan": ""}])
    s = [
        {"u_start": 1, "u_end": 1, "bbox": [0.1, 0.1, 0.8, 0.02]},  # lebih rendah dari min_height
        {"u_start": 2, "u_end": 3, "bbox": [0.1, 0.3, 0.8, 0.15]},
    ]
    await classify_slots(mc, jpeg(), s, min_height=0.05)
    assert [x["status"] for x in s] == ["tidak_jelas", "kosong"]
    assert len(chat.calls) == 1


def test_is_shelf_like_reads_muse_name():
    from app.vision.identify import is_shelf_like

    shelf = Unit(CLASS_BY_PROMPT["equipment"], (0, 0, 1, 1), 0.9)
    shelf.ident = Identification(nama="Rak Shelf")
    plain = Unit(CLASS_BY_PROMPT["equipment"], (0, 0, 1, 1), 0.9)
    plain.ident = Identification(nama="UPS")
    assert is_shelf_like(shelf) and not is_shelf_like(plain) and not is_shelf_like(Unit(SWITCH, (0, 0, 1, 1), 0.9))
