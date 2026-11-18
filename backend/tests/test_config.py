"""Settings read from the environment."""

import pytest

from app.config import database_url


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        # Neon / Render style
        ("postgres://u:p@host/db?sslmode=require", "postgresql+psycopg://u:p@host/db?sslmode=require"),
        ("postgresql://u:p@host:5432/db", "postgresql+psycopg://u:p@host:5432/db"),
        # Already right (local .env)
        ("postgresql+psycopg://u:p@localhost:5434/db", "postgresql+psycopg://u:p@localhost:5434/db"),
        # Not set
        (None, None),
        ("", ""),
    ],
)
def test_database_url_names_the_psycopg_driver(given, expected):
    assert database_url(given) == expected
