import io
from types import SimpleNamespace

import pytest
from PIL import Image

from app.core.config import Settings
from app.clients.meta_client import MetaApiError, MetaClient, prepare_image


def make_jpeg(w=200, h=100) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), "gray").save(buf, format="JPEG")
    return buf.getvalue()


class FakeStream:
    def __init__(self, events):
        self.events = events

    def __aiter__(self):
        async def gen():
            for e in self.events:
                yield e

        return gen()


LANE = dict(item_id="msg_1", output_index=0, content_index=0)


def delta(text):
    return SimpleNamespace(type="response.output_text.delta", delta=text, **LANE)


def done(text):
    return SimpleNamespace(type="response.output_text.done", text=text, **LANE)


COMPLETED = SimpleNamespace(type="response.completed", response=SimpleNamespace(status="completed"))


class FakeResponses:
    def __init__(self, events):
        self.events = events
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return FakeStream(self.events)


def fake_client(events):
    return SimpleNamespace(responses=FakeResponses(events))


def test_prepare_image_downsizes_and_reports_size():
    jpeg, w, h = prepare_image(make_jpeg(4000, 2000), max_side=1000)
    assert (w, h) == (1000, 500)
    assert jpeg[:2] == b"\xff\xd8"


async def test_segment_returns_normalized_boxes():
    # Payload mask sengaja tidak valid: parser tetap mengembalikan box (diagnostik invalid_mask_payload),
    # jadi deteksi tidak hilang hanya karena mask rusak. Mask nyata diuji di smoke test live.
    line = (
        "<0f>0<|box;x1=20;y1=10;x2=119;y2=59;w=200;h=100;c=0.9|>"
        "<|mask;x=0;y=0;c=0.9;data=2,2,!{{|>"
    )
    client = fake_client([delta(line), done(line), COMPLETED])
    mc = MetaClient(settings=Settings(_env_file=None), client=client)

    dets = await mc.segment(make_jpeg(), "network switch", with_masks=False)

    assert len(dets) == 1
    x, y, w, h = dets[0].bbox
    assert (x, y) == pytest.approx((0.1, 0.1))
    assert (w, h) == pytest.approx((0.5, 0.5))
    assert dets[0].label == "network switch"
    call = client.responses.calls[0]
    assert call["model"] == "sam-3.1" and call["stream"] is True
    assert call["input"][0]["content"][0]["text"] == "network switch"


async def test_segment_empty_match_is_not_error():
    mc = MetaClient(settings=Settings(_env_file=None), client=fake_client([done(""), COMPLETED]))
    assert await mc.segment(make_jpeg(), "ups", with_masks=False) == []


async def test_segment_wraps_failures():
    class Boom:
        async def create(self, **kw):
            raise ConnectionError("down")

    mc = MetaClient(settings=Settings(_env_file=None), client=SimpleNamespace(responses=Boom()))
    with pytest.raises(MetaApiError):
        await mc.segment(make_jpeg(), "ups")


def test_missing_key_gives_clear_error():
    with pytest.raises(MetaApiError, match="MODEL_API_KEY"):
        MetaClient(settings=Settings(_env_file=None, model_api_key=""))
