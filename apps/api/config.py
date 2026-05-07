from functools import lru_cache
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # QStash
    qstash_token: str = ""
    qstash_current_signing_key: str = ""

    # Modal workers
    modal_worker_url: str = ""
    worker_secret: str = ""

    # AI
    gemini_api_key: str = ""
    anthropic_api_key: str = ""

    # Cloudflare R2
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_endpoint: str = ""
    r2_bucket_name: str = "olpdf-documents"

    # Email
    resend_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    email_from: str = "no-reply@olpdf.xyz"
    app_url: str = "https://olpdf.xyz"

    # CORS
    allowed_origins: str = ""

    # Monitoring
    sentry_dsn: str = ""

    # Dev
    olpdf_dev_mode: bool = False

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def coerce_origins(cls, v: str) -> str:
        return v or ""

    @property
    def cors_origins(self) -> List[str]:
        if self.allowed_origins:
            return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]
        if self.olpdf_dev_mode:
            return ["http://localhost:3000", "http://127.0.0.1:3000"]
        return []


@lru_cache
def get_settings() -> Settings:
    return Settings()
