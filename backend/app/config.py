"""Configuration objects for the Spendora API.

Settings are read from environment variables so the same code can run
unchanged on a laptop, in CI, and in production - only the environment
differs.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# backend/ - the directory that holds .env
BASE_DIR = Path(__file__).resolve().parent.parent

# Load backend/.env into os.environ. Explicit path, so it works no matter
# which directory the process was started from (Gunicorn, Docker, pytest).
load_dotenv(BASE_DIR / ".env")


class Config:
    """Settings shared by every environment."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-insecure-key")

    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    # Legacy change-tracking feature: extra memory, no benefit to us.
    SQLALCHEMY_TRACK_MODIFICATIONS = False


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    # Separate database, so running the test suite can never wipe dev data.
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://expense_user:expense_pass@localhost:5434/expense_tracker_test",
    )


class ProductionConfig(Config):
    DEBUG = False


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(name=None):
    """Return the config class for ``name``, defaulting to $APP_ENV."""
    name = name or os.environ.get("APP_ENV", "development")
    return config_by_name.get(name, DevelopmentConfig)
