import io
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import app.api.main as main_mod
from app.core.cache import JsonCache, make_key
from app.core.config import Settings
from app.clients.meta_client import MetaApiError, MetaClient
from tests.test_meta_client import COMPLETED, FakeResponses, FakeStream, delta, done, make_jpeg


def sam_client(cache):
    line = "<0f>0<|box;x1=20;y1=10;x2=119;y2=59;w=200;h=100;c=0.9|>"
    responses = FakeResponses([delta(line), done(line), COMPLETED])
    mc = MetaClient(settings=Settings(_env_file=None), client=SimpleNamespace(responses=responses), cache=cache)
    return mc, responses


class CountingChat:
    def __init__(self, replies):
        self.replies, self.calls = list(replies), 0

    async def create(self, **kwargs):
        self.calls += 1
        r = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        if isinstance(r, Exception):
            raise r
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(r)))])


def muse_client(replies, cache):
    chat = CountingChat(replies)
    mc = MetaClient(
        settings=Settings(_env_file=None),
        client=SimpleNamespace(chat=SimpleNamespace(completions=chat)),
        cache=cache,
    )
    mc.retry_delay = 0
    return mc, chat


KW = dict(system="s", user_text="u", schema_name="N", schema={"type": "object"})


def test_make_key_separates_parts():
    assert make_key("ab", "c") != make_key("a", "bc")
    assert make_key("a", b"x") == make_key("a", "x")


def test_json_cache_roundtrip_memory_and_disk(tmp_path):
    c = JsonCache(tmp_path)
    assert c.get("ns", "k") is None
    c.set("ns", "k", {"a": 1})
    assert c.get("ns", "k") == {"a": 1}
    # instance baru (memori kosong) membaca dari disk
    assert JsonCache(tmp_path).get("ns", "k") == {"a": 1}


def test_json_cache_disabled_stores_nothing(tmp_path):
    c = JsonCache(tmp_path, enabled=False)
    c.set("ns", "k", {"a": 1})
    assert c.get("ns", "k") is None
    assert not any(tmp_path.iterdir())


def test_json_cache_corrupt_file_is_ignored(tmp_path):
    (tmp_path / "ns").mkdir()
    (tmp_path / "ns" / "k.json").write_text("{rusak", encoding="utf-8")
    assert JsonCache(tmp_path).get("ns", "k") is None


def test_json_cache_lru_evicts_oldest_from_memory():
    c = JsonCache(None, max_memory=2)
    for i in range(3):
        c.set("ns", str(i), i)
    assert c.get("ns", "0") is None and c.get("ns", "2") == 2


async def test_sam_second_call_with_same_input_skips_the_api(tmp_path):
    mc, responses = sam_client(JsonCache(tmp_path))
    jpeg = make_jpeg()
    first = await mc.segment(jpeg, "network switch")
    second = await mc.segment(jpeg, "network switch")
    assert len(responses.calls) == 1
    assert [d.bbox for d in second] == [d.bbox for d in first]


async def test_sam_different_prompt_or_image_does_not_share_cache(tmp_path):
    mc, responses = sam_client(JsonCache(tmp_path))
    await mc.segment(make_jpeg(), "network switch")
    await mc.segment(make_jpeg(), "UPS")
    await mc.segment(make_jpeg(300, 150), "network switch")
    assert len(responses.calls) == 3


async def test_sam_error_is_not_cached(tmp_path):
    class Boom:
        calls = 0

        async def create(self, **kw):
            Boom.calls += 1
            raise ConnectionError("down")

    cache = JsonCache(tmp_path)
    mc = MetaClient(settings=Settings(_env_file=None), client=SimpleNamespace(responses=Boom()), cache=cache)
    for _ in range(2):
        with pytest.raises(MetaApiError):
            await mc.segment(make_jpeg(), "ups")
    assert Boom.calls == 2
    assert not list(tmp_path.rglob("*.json"))


async def test_muse_second_call_hits_cache_and_other_inputs_do_not(tmp_path):
    mc, chat = muse_client([{"ok": 1}], JsonCache(tmp_path))
    img = make_jpeg()
    assert await mc.chat_json(image_jpeg=img, **KW) == {"ok": 1}
    assert await mc.chat_json(image_jpeg=img, **KW) == {"ok": 1}
    assert chat.calls == 1
    await mc.chat_json(image_jpeg=make_jpeg(300, 150), **KW)
    await mc.chat_json(image_jpeg=img, **{**KW, "user_text": "lain"})
    await mc.chat_json(image_jpeg=img, model="muse-ember-1.0", **KW)
    assert chat.calls == 4


async def test_muse_failure_is_not_cached(tmp_path):
    mc, chat = muse_client([RuntimeError("x")], JsonCache(tmp_path))
    with pytest.raises(MetaApiError):
        await mc.chat_json(image_jpeg=make_jpeg(), retries=1, **KW)
    assert not list(tmp_path.rglob("*.json"))


async def test_disabled_cache_always_calls_the_api():
    mc, chat = muse_client([{"ok": 1}], JsonCache(None, enabled=False))
    for _ in range(2):
        await mc.chat_json(image_jpeg=make_jpeg(), **KW)
    assert chat.calls == 2


def test_analyze_endpoint_serves_repeat_photo_from_cache(tmp_path, monkeypatch):
    from tests.test_analyze import FakeMeta, jpeg_bytes

    monkeypatch.setattr(main_mod, "result_cache", JsonCache(tmp_path))
    meta = FakeMeta()
    main_mod.app.dependency_overrides[main_mod.get_meta_client] = lambda: meta
    try:
        client = TestClient(main_mod.app)
        files = {"photo": ("rak.jpg", jpeg_bytes(), "image/jpeg")}
        first = client.post("/analyze", files=files)
        calls_after_first = meta.calls
        second = client.post("/analyze", files=files)
        assert first.status_code == second.status_code == 200
        assert second.json() == first.json()
        assert meta.calls == calls_after_first  # jawaban kedua: 0 panggilan model
        client.post("/analyze?rack_u=12", files=files)  # rack_u berbeda -> tidak berbagi cache
        assert meta.calls > calls_after_first
    finally:
        main_mod.app.dependency_overrides.clear()
