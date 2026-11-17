"""Tests for the /api/expenses endpoints."""

import pytest


def create(client, body):
    response = client.post("/api/expenses", json=body)
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def test_root_says_what_the_server_is(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.get_json()["name"] == "Spendora API"


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok", "database": "ok"}


def test_list_starts_empty(client):
    response = client.get("/api/expenses")
    assert response.status_code == 200
    assert response.get_json() == []


def test_create_returns_the_saved_expense(client, new_expense):
    response = client.post("/api/expenses", json=new_expense())

    assert response.status_code == 201
    data = response.get_json()
    assert response.headers["Location"] == f"/api/expenses/{data['id']}"
    assert data["title"] == "Weekly groceries"
    assert data["amount"] == "84.35"
    assert data["category"] == "Food"
    assert data["expense_date"] == "2026-11-16"
    assert data["description"] == "Supermarket run"
    assert data["created_at"] and data["updated_at"]


def test_get_one(client, new_expense):
    created = create(client, new_expense())
    response = client.get(f"/api/expenses/{created['id']}")
    assert response.status_code == 200
    assert response.get_json() == created


def test_list_is_newest_date_first(client, new_expense):
    create(client, new_expense(title="Old", expense_date="2026-10-01"))
    create(client, new_expense(title="New", expense_date="2026-11-20"))
    create(client, new_expense(title="Middle", expense_date="2026-11-01"))

    titles = [e["title"] for e in client.get("/api/expenses").get_json()]
    assert titles == ["New", "Middle", "Old"]


def test_text_is_trimmed_and_blank_description_is_null(client, new_expense):
    data = create(
        client,
        new_expense(title="  Taxi  ", category=" Transport ", description="   "),
    )
    assert data["title"] == "Taxi"
    assert data["category"] == "Transport"
    assert data["description"] is None


@pytest.mark.parametrize(
    ("sent", "stored"),
    [("12.5", "12.50"), (12.5, "12.50"), (7, "7.00"), ("3.100", "3.10")],
)
def test_amount_accepts_numbers_and_strings(client, new_expense, sent, stored):
    assert create(client, new_expense(amount=sent))["amount"] == stored


def test_update_replaces_fields(client, new_expense):
    created = create(client, new_expense())

    response = client.put(
        f"/api/expenses/{created['id']}",
        json=new_expense(title="Pharmacy", amount="31.90", category="Health",
                         description=None),
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["id"] == created["id"]
    assert data["title"] == "Pharmacy"
    assert data["amount"] == "31.90"
    assert data["category"] == "Health"
    assert data["description"] is None
    assert client.get(f"/api/expenses/{created['id']}").get_json() == data


def test_delete(client, new_expense):
    created = create(client, new_expense())

    response = client.delete(f"/api/expenses/{created['id']}")

    assert response.status_code == 204
    assert client.get(f"/api/expenses/{created['id']}").status_code == 404
    assert client.get("/api/expenses").get_json() == []


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_missing_expense_is_404_json(client, new_expense, method):
    response = getattr(client, method)("/api/expenses/999", json=new_expense())
    assert response.status_code == 404
    assert response.get_json() == {"error": "Expense not found."}


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"title": ""}, "title"),
        ({"title": "   "}, "title"),
        ({"title": "x" * 121}, "title"),
        ({"title": None}, "title"),
        ({"amount": "0"}, "amount"),
        ({"amount": "-5"}, "amount"),
        ({"amount": "1.234"}, "amount"),
        ({"amount": "100000000.00"}, "amount"),
        ({"amount": "abc"}, "amount"),
        ({"amount": "NaN"}, "amount"),
        ({"amount": True}, "amount"),
        ({"amount": None}, "amount"),
        ({"category": ""}, "category"),
        ({"category": "x" * 51}, "category"),
        ({"expense_date": "2026-02-30"}, "expense_date"),
        ({"expense_date": "yesterday"}, "expense_date"),
        ({"expense_date": None}, "expense_date"),
        ({"description": 42}, "description"),
    ],
)
def test_invalid_fields_are_rejected(client, new_expense, overrides, field):
    response = client.post("/api/expenses", json=new_expense(**overrides))

    assert response.status_code == 422
    data = response.get_json()
    assert data["error"] == "Validation failed."
    assert list(data["fields"]) == [field]
    assert client.get("/api/expenses").get_json() == []


def test_every_bad_field_is_reported_at_once(client):
    response = client.post("/api/expenses", json={})
    assert response.status_code == 422
    assert set(response.get_json()["fields"]) == {
        "title", "amount", "category", "expense_date",
    }


def test_invalid_update_changes_nothing(client, new_expense):
    created = create(client, new_expense())

    response = client.put(f"/api/expenses/{created['id']}", json=new_expense(amount="0"))

    assert response.status_code == 422
    assert client.get(f"/api/expenses/{created['id']}").get_json() == created


def test_non_json_body_is_400(client):
    response = client.post("/api/expenses", data="title=x", content_type="text/plain")
    assert response.status_code == 400
    assert response.get_json() == {"error": "Request body must be JSON."}


def test_json_array_body_is_422(client):
    response = client.post("/api/expenses", json=[1, 2])
    assert response.status_code == 422
    assert response.get_json()["fields"] == {"body": "Expected a JSON object."}


def test_unknown_url_is_404_json(client):
    response = client.get("/api/nope")
    assert response.status_code == 404
    assert "error" in response.get_json()
