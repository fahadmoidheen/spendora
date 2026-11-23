"""Shared pytest fixtures.

Tests run against the separate ``expense_tracker_test`` database
(TestingConfig). Tables are created once per run and emptied after every
test, so each test starts from a blank slate.

Logins: instead of Auth0, the tests sign tokens with a throwaway RSA key
made for this run (``make_token``). ``client`` is logged in as "user-a",
``other_client`` as "user-b", ``anon_client`` not at all.
"""

import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import text

from app import create_app
from app.extensions import db


def _new_key_pair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_pem = private_key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return private_key, public_pem


SIGNING_KEY, PUBLIC_KEY_PEM = _new_key_pair()


@pytest.fixture(scope="session")
def app():
    app = create_app("testing")
    app.config["AUTH_TEST_PUBLIC_KEY"] = PUBLIC_KEY_PEM

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
        db.session.execute(text("TRUNCATE TABLE expenses, budgets, todos RESTART IDENTITY"))
        db.session.commit()


@pytest.fixture
def make_token(app):
    """Sign an access token like Auth0 would; override any claim."""

    def make(sub="user-a", key=SIGNING_KEY, **claims):
        now = int(time.time())
        payload = {
            "iss": f"https://{app.config['AUTH0_DOMAIN']}/",
            "aud": app.config["AUTH0_AUDIENCE"],
            "sub": sub,
            "iat": now,
            "exp": now + 3600,
        }
        payload.update(claims)
        payload = {k: v for k, v in payload.items() if v is not None}
        return jwt.encode(payload, key, algorithm="RS256")

    return make


def _client_for(app, token=None):
    client = app.test_client()
    if token:
        client.environ_base["HTTP_AUTHORIZATION"] = f"Bearer {token}"
    return client


@pytest.fixture
def client(app, make_token):
    return _client_for(app, make_token("user-a"))


@pytest.fixture
def other_client(app, make_token):
    return _client_for(app, make_token("user-b"))


@pytest.fixture
def anon_client(app):
    return _client_for(app)


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
