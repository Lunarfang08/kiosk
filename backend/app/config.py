from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parents[2]
_ENV_CANDIDATES = (
    str(_ROOT / ".env"),
    ".env",
    "../.env",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_CANDIDATES,
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,
    )

    admin_token: str = "change-me-admin-token"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    database_path: str = "./avatar_data/kiosk.db"
    avatar_data_dir: str = "./avatar_data"
    max_upload_mb: int = 25

    dograh_base_url: str = "https://api.dograh.com"
    dograh_api_key: str = ""
    dograh_agent_id: str = "14591"
    dograh_embed_token: str = ""

    livetalking_base_url: str = "http://localhost:8010"
    livetalking_enabled: bool = False
    avatar_engine: str = "portrait"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def avatar_root(self) -> Path:
        return Path(self.avatar_data_dir).resolve()

    @property
    def uploads_dir(self) -> Path:
        return self.avatar_root / "uploads"

    @property
    def generated_dir(self) -> Path:
        return self.avatar_root / "generated"

    @property
    def configs_dir(self) -> Path:
        return self.avatar_root / "configs"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
