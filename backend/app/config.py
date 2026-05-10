"""
Application Configuration
Loads settings from environment variables
"""
from pydantic_settings import BaseSettings
from typing import Optional, List
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    APP_NAME: str = "M365 Multi-Tenant Admin"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-this-in-production-use-strong-secret"

    # Tenant secret encryption (Fernet key, urlsafe base64; 32-byte raw key)
    # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    TENANT_SECRET_ENCRYPTION_KEY: str = "change-this-in-production-generate-fernet-key"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./m365_admin.db"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # API Settings
    API_V1_PREFIX: str = "/api/v1"

    def validate_security(self) -> None:
        if not self.DEBUG:
            if self.SECRET_KEY in ("change-this-in-production-use-strong-secret", "", None):
                raise ValueError("SECRET_KEY must be set to a strong value in production.")
            if self.TENANT_SECRET_ENCRYPTION_KEY in ("change-this-in-production-generate-fernet-key", "", None):
                raise ValueError("TENANT_SECRET_ENCRYPTION_KEY must be set in production.")
            if "*" in (self.cors_origins_list() or []):
                raise ValueError("CORS_ORIGINS='*' is not allowed in production.")

    def cors_origins_list(self) -> List[str]:
        raw = (self.CORS_ORIGINS or "").strip()
        if not raw:
            return []
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    settings = Settings()
    settings.validate_security()
    return settings


settings = get_settings()
