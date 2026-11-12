from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app


def test_health_ok():
    r = TestClient(app).get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_config_defaults(monkeypatch):
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    s = Settings(_env_file=None)
    assert s.model_api_base_url == "https://api.meta.ai/v1"
    assert s.model_api_key == ""
    assert s.knowledge_dir.name == "docs"
