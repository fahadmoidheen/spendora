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


def database_url(value):
    """Name the psycopg 3 driver in a Postgres URL.

    Hosts like Neon and Render hand out ``postgres://...`` or
    ``postgresql://...``; SQLAlchemy reads those as "use psycopg2", which
    isn't installed. Anything else is returned unchanged.
    """
    if value and value.startswith(("postgres://", "postgresql://")):
        return "postgresql+psycopg://" + value.split("://", 1)[1]
    return value


class Config:
    """Settings shared by every environment."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-insecure-key")

    SQLALCHEMY_DATABASE_URI = database_url(os.environ.get("DATABASE_URL"))
    # Legacy change-tracking feature: extra memory, no benefit to us.
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Hosted databases (Neon) pause when idle and drop open connections.
    # Check each pooled connection before use, and renew them every few
    # minutes, so the first request after a pause doesn't fail.
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 280}

    # Login (see app/auth.py and README "Login"). Tokens must come from this
    # Auth0 tenant and be issued for this API. Neither value is a secret.
    AUTH0_DOMAIN = (
        os.environ.get("AUTH0_DOMAIN", "").strip().removeprefix("https://").rstrip("/")
    )
    AUTH0_AUDIENCE = os.environ.get("AUTH0_AUDIENCE", "").strip()


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    # Separate database, so running the test suite can never wipe dev data.
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://expense_user:expense_pass@localhost:5434/expense_tracker_test",
    )
    # Tests sign their own tokens (tests/conftest.py); these just have to
    # match what they put in the tokens. Never a real tenant.
    AUTH0_DOMAIN = "spendora-test.example"
    AUTH0_AUDIENCE = "https://api.spendora.test"


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
