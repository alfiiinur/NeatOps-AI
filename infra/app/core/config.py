from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

INFRA_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = INFRA_DIR.parent


class Settings(BaseSettings):
    """Konfigurasi backend. Dibaca dari .env di root project."""

    model_api_key: str = ""
    model_api_base_url: str = "https://api.meta.ai/v1"
    identify_model: str = "muse-spark-1.3"  # bisa diganti "muse-ember-1.0" bila ingin lebih hemat
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    knowledge_dir: Path = INFRA_DIR / "knowledge" / "docs"

    # Cache hasil model (hemat token): gambar + prompt yang sama tidak dikirim dua kali.
    cache_enabled: bool = True
    cache_dir: Path = INFRA_DIR / ".cache"

    # Ukuran input yang memengaruhi biaya token. Turunkan bila ingin lebih hemat, naikkan bila akurasi turun.
    max_image_side: int = 1536  # sisi terpanjang gambar yang dikirim ke SAM
    crop_min_width: int = 512  # lebar minimum crop yang dikirim ke Muse

    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )


def get_settings() -> Settings:
    return Settings()
