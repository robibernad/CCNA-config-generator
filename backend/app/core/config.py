"""Application configuration management"""
from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """Application settings"""

    # Application Mode
    # Prefer live by default; override in .env when you explicitly want mocks
    MOCK_MODE: bool = False

    # CORS Configuration (comma-separated)
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Session Configuration
    SESSION_TTL: int = 7200  # 2 hours in seconds

    # Artifacts Storage
    ARTIFACTS_DIR: str = "./artifacts"
    ENABLE_ARTIFACTS: bool = False

    # Logging
    LOG_LEVEL: str = "INFO"

    # API Configuration
    API_PREFIX: str = "/api"

    # Security
    ALLOW_LOCALHOST_GNS3: bool = True

    # AI Validation (Optional)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string to list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
