"""Application configuration using Pydantic settings."""

from typing import List, Union
import json

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    project_name: str = Field(default="HTHGSE Shewhart Chatbot", description="Project name")
    environment: str = Field(default="development", description="Environment")
    debug: bool = Field(default=False, description="Debug mode")

    # Server settings
    host: str = Field(default="0.0.0.0", description="Host to bind to")
    port: int = Field(default=8000, description="Port to bind to")
    reload: bool = Field(default=False, description="Enable auto-reload")

    # CORS settings
    cors_origins: Union[str, List[str]] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
        description="Allowed CORS origins"
    )

    # Security settings
    secret_key: str = Field(
        default="your-secret-key-here-change-in-production",
        description="Secret key for security"
    )
    allowed_hosts: Union[str, List[str]] = Field(
        default=["localhost", "127.0.0.1", "test"],
        description="Allowed hosts"
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            # Try to parse as JSON array first
            if v.strip().startswith("["):
                try:
                    return json.loads(v)
                except (json.JSONDecodeError, ValueError):
                    pass
            # Parse as comma-separated string
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("allowed_hosts", mode="before")
    @classmethod
    def parse_allowed_hosts(cls, v):
        """Parse allowed hosts from string or list."""
        if isinstance(v, str):
            # Try to parse as JSON array first
            if v.strip().startswith("["):
                try:
                    return json.loads(v)
                except (json.JSONDecodeError, ValueError):
                    pass
            # Parse as comma-separated string
            return [host.strip() for host in v.split(",") if host.strip()]
        return v

    openai_api_key: str = Field(
        default="",
        description="OpenAI API key"
    )

    # Logging settings
    log_level: str = Field(default="INFO", description="Log level")
    log_format: str = Field(default="json", description="Log format")

    # File settings
    vector_store_id: str = Field(
        default="",
        description="Vector store ID for file search"
    )
    upload_dir: str = Field(default="./uploads", description="Directory for file uploads")
    max_file_size: int = Field(default=52428800, description="Maximum file size in bytes (50MB - OpenAI limit for CSV/spreadsheet files)")

    # Database settings
    database_url: str = Field(
        default="",
        description="Supabase database URL"
    )
    supabase_url: str = Field(
        default="",
        description="Supabase project URL"
    )
    supabase_anon_key: str = Field(
        default="",
        description="Supabase anonymous key"
    )

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore"
    }


# Global settings instance
settings = Settings()
