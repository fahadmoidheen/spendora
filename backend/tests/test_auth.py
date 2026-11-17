"""Login checks and per-user data isolation."""

import time

import pytest
from sqlalchemy import select

from app import create_app
from app.commands import UNASSIGNED
from app.extensions import db
from app.models import Budget, Expense

from tests.conftest import _new_key_pair

PROTECTED = [
    ("get", "/api/expenses"),
    ("post", "/api/expenses"),
    ("get", "/api/expenses/1"),
    ("put", "/api/expenses/1"),
    ("delete", "/api/expenses/1"),
    ("get", "/api/budgets"),
    ("post", "/api/budgets"),
    ("put", "/api/budgets/1"),
    ("delete", "/api/budgets/1"),
]


# --- Who gets in -------------------------------------------------------


@pytest.mark.parametrize(("method", "url"), PROTECTED)
def test_no_token_is_401(anon_client, method, url):
    response = getattr(anon_client, method)(url, json={})
    assert response.status_code == 401
    assert response.get_json() == {"error": "Log in to continue."}
    assert response.headers["WWW-Authenticate"].startswith("Bearer")


@pytest.mark.parametrize("url", ["/", "/api/health"])
def test_public_endpoints_need_no_login(anon_client, url):
    assert anon_client.get(url).status_code == 200


@pytest.mark.parametrize("header", ["Token abc", "Bearer", "Bearer   ", "abc"])
def test_malformed_header_is_401(anon_client, header):
    response = anon_client.get("/api/expenses", headers={"Authorization": header})
    assert response.status_code == 401


def bad_token_cases(make_token):
    other_key, _ = _new_key_pair()
    long_ago = int(time.time()) - 7200
    return {
        "wrong audience": make_token(aud="https://some-other-api"),
        "wrong issuer": make_token(iss="https://evil.example/"),
        "expired": make_token(iat=long_ago, exp=long_ago + 60),
        "signed by another key": make_token(key=other_key),
        "no subject": make_token(sub=None),
        "no expiry": make_token(exp=None),
        "not a token": "not.a.token",
    }


@pytest.mark.parametrize(
    "case",
    ["wrong audience", "wrong issuer", "expired", "signed by another key",
     "no subject", "no expiry", "not a token"],
)
def test_bad_tokens_are_401(anon_client, make_token, case):
    token = bad_token_cases(make_token)[case]
    response = anon_client.get(
        "/api/expenses", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401
    assert "error" in response.get_json()


def test_expired_token_says_so(anon_client, make_token):
    long_ago = int(time.time()) - 7200
    token = make_token(iat=long_ago, exp=long_ago + 60)
    response = anon_client.get("/api/expenses", headers={"Authorization": f"Bearer {token}"})
    assert response.get_json() == {"error": "Your session has expired. Log in again."}


def test_unsigned_token_is_rejected(anon_client, app):
    # alg "none": a classic way to sneak past careless JWT checks.
    import jwt

    token = jwt.encode(
        {"iss": f"https://{app.config['AUTH0_DOMAIN']}/", "aud": app.config["AUTH0_AUDIENCE"],
         "sub": "user-a", "exp": int(time.time()) + 3600},
        key=None,
        algorithm="none",
    )
    response = anon_client.get("/api/expenses", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_login_not_configured_is_503(make_token):
    app = create_app("testing")
    app.config["AUTH0_DOMAIN"] = ""
    response = app.test_client().get(
        "/api/expenses", headers={"Authorization": f"Bearer {make_token()}"}
    )
    assert response.status_code == 503
    assert "AUTH0_DOMAIN" in response.get_json()["error"]


# --- Each user sees only their own data --------------------------------


def test_users_only_see_their_own_entries(client, other_client, new_expense):
    mine = client.post("/api/expenses", json=new_expense(title="Mine")).get_json()
    other_client.post("/api/expenses", json=new_expense(title="Theirs"))

    assert [e["title"] for e in client.get("/api/expenses").get_json()] == ["Mine"]
    assert [e["title"] for e in other_client.get("/api/expenses").get_json()] == ["Theirs"]
    assert "user_id" not in mine


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_someone_elses_entry_is_404(client, other_client, new_expense, method):
    entry = client.post("/api/expenses", json=new_expense()).get_json()

    response = getattr(other_client, method)(f"/api/expenses/{entry['id']}", json=new_expense())

    assert response.status_code == 404
    assert response.get_json() == {"error": "Expense not found."}
    # ...and it is untouched.
    assert client.get(f"/api/expenses/{entry['id']}").get_json() == entry


def test_users_have_separate_budgets(client, other_client):
    body = {"category": "Food", "monthly_limit": "100"}
    assert client.post("/api/budgets", json=body).status_code == 201
    # Same category for another user is fine...
    assert other_client.post("/api/budgets", json=body).status_code == 201
    # ...but twice for the same user is not.
    assert client.post("/api/budgets", json=body).status_code == 409

    assert len(client.get("/api/budgets").get_json()) == 1
    assert len(other_client.get("/api/budgets").get_json()) == 1


@pytest.mark.parametrize("method", ["put", "delete"])
def test_someone_elses_budget_is_404(client, other_client, method):
    budget = client.post(
        "/api/budgets", json={"category": "Food", "monthly_limit": "100"}
    ).get_json()

    response = getattr(other_client, method)(
        f"/api/budgets/{budget['id']}", json={"category": "Food", "monthly_limit": "1"}
    )

    assert response.status_code == 404
    assert client.get("/api/budgets").get_json()[0]["monthly_limit"] == "100.00"


# --- flask assign-owner ---------------------------------------------------


def _add_unassigned(app, new_expense):
    with app.app_context():
        db.session.add(Expense(user_id=UNASSIGNED, type="expense", title="Old",
                               amount="10.00", category="Food", expense_date="2026-11-01"))
        db.session.add(Budget(user_id=UNASSIGNED, category="Food", monthly_limit="50"))
        db.session.add(Budget(user_id=UNASSIGNED, category="Travel", monthly_limit="80"))
        db.session.commit()


def test_assign_owner_claims_old_rows(app, client, new_expense):
    _add_unassigned(app, new_expense)

    result = app.test_cli_runner().invoke(args=["assign-owner", "user-a"])

    assert result.exit_code == 0, result.output
    assert "Gave 1 entries and 2 budgets to user-a." in result.output
    assert [e["title"] for e in client.get("/api/expenses").get_json()] == ["Old"]
    assert len(client.get("/api/budgets").get_json()) == 2


def test_assign_owner_skips_categories_already_budgeted(app, client, new_expense):
    client.post("/api/budgets", json={"category": "Food", "monthly_limit": "100"})
    _add_unassigned(app, new_expense)

    result = app.test_cli_runner().invoke(args=["assign-owner", "user-a"])

    assert "Gave 1 entries and 1 budgets to user-a." in result.output
    assert "1 budget(s) left unassigned" in result.output
    with app.app_context():
        left = db.session.scalars(select(Budget).where(Budget.user_id == UNASSIGNED)).all()
        assert [b.category for b in left] == ["Food"]


def test_assign_owner_rejects_placeholder(app):
    result = app.test_cli_runner().invoke(args=["assign-owner", UNASSIGNED])
    assert result.exit_code != 0
