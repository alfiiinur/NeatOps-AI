import json

from fastapi.testclient import TestClient

from app.api.main import CHAT_MODE_SYSTEM, ChatRequest, app, get_meta_client


class FakeChatMeta:
    """Pengganti MetaClient untuk /chat: merekam system prompt yang dikirim."""

    def __init__(self):
        self.system = ""

    async def chat_text(self, *, system, messages, images=None, model=None, reasoning_effort=None):
        self.system = system
        return "ok"


def teardown_function():
    app.dependency_overrides.clear()


def test_desk_mode_has_prompt_and_is_accepted():
    assert "Meja Kerja" in CHAT_MODE_SYSTEM["desk"]
    assert ChatRequest(message="halo", mode="desk").mode == "desk"


def test_chat_desk_uses_desk_prompt_with_context():
    meta = FakeChatMeta()
    app.dependency_overrides[get_meta_client] = lambda: meta
    ctx = {"desk": {"w": 160, "d": 80}, "result": {"skor": 90}}
    r = TestClient(app).post(
        "/chat",
        data={"message": "apa yang kurang?", "mode": "desk", "context": json.dumps(ctx)},
    )
    assert r.status_code == 200
    assert r.json()["answer"] == "ok"
    assert "Meja Kerja" in meta.system
    assert '"skor": 90' in meta.system


def test_chat_unknown_mode_rejected():
    app.dependency_overrides[get_meta_client] = lambda: FakeChatMeta()
    r = TestClient(app).post("/chat", data={"message": "halo", "mode": "bogus"})
    assert r.status_code == 422
