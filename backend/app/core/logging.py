"""Logging configuration."""

import logging
import sys
from typing import Any

from .config import settings


def setup_logging() -> None:
    """Setup logging configuration."""

    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
    )

    # Set specific logger levels
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)

    # Create logger for this application
    logger = logging.getLogger("hthgse-shewhart-chatbot")
    logger.setLevel(getattr(logging, settings.log_level.upper()))

    # Log startup information
    logger.info("Logging configured successfully")
    logger.info("Environment: %s", settings.environment)
    logger.info("Debug mode: %s", settings.debug)
    logger.info("Log level: %s", settings.log_level)


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance with the given name."""
    return logging.getLogger(f"hthgse-shewhart-chatbot.{name}")
