"""Shared pytest fixtures.

Tests run against the separate ``expense_tracker_test`` database
(TestingConfig). Tables are created once per run and emptied after every
test, so each test starts from a blank slate.
"""

import pytest
from sqlalchemy import text

from app import create_app
from app.extensions import db


@pytest.fixture(scope="session")
def app():
    app = create_app("testing")

    # drop_all() below wipes every table - refuse to run against anything
    # but a test database.
    uri = app.config["SQLALCHEMY_DATABASE_URI"]
    assert uri.endswith("_test"), f"Refusing to run tests against {uri!r}"

    with app.app_context():
        db.drop_all()
        db.create_all()
    yield app
    with app.app_context():
        db.drop_all()


@pytest.fixture(autouse=True)
def _empty_tables(app):
    yield
    with app.app_context():
        db.session.execute(text("TRUNCATE TABLE expenses, budgets RESTART IDENTITY"))
        db.session.commit()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def new_expense():
    """Valid request body; override fields per test."""

    def make(**overrides):
        body = {
            "title": "Weekly groceries",
            "amount": "84.35",
            "category": "Food",
            "expense_date": "2026-11-16",
            "description": "Supermarket run",
        }
        body.update(overrides)
        return body

    return make
