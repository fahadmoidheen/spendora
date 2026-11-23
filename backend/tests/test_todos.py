"""Tests for the /api/todos endpoints."""

from datetime import date

import pytest

from app.routes.todos import next_due


def create(client, **body):
    body.setdefault("title", "Call the bank")
    response = client.post("/api/todos", json=body)
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def complete(client, todo_id, **body):
    return client.post(f"/api/todos/{todo_id}/complete", json=body)


def test_list_starts_empty(client):
    assert client.get("/api/todos").get_json() == []


def test_create_a_plain_todo(client):
    response = client.post("/api/todos", json={"title": "  Call the bank  "})

    assert response.status_code == 201
    data = response.get_json()
    assert response.headers["Location"] == f"/api/todos/{data['id']}"
    assert data["title"] == "Call the bank"
    assert data["due_date"] is None
    assert data["amount"] is None
    assert data["category"] is None
    assert data["repeat"] == "none"
    assert data["done"] is False
    assert data["done_at"] is None


def test_create_a_payment(client):
    data = create(
        client,
        title="Rent",
        due_date="2026-12-01",
        amount="15000",
        category="Housing",
        repeat="monthly",
    )
    assert data["due_date"] == "2026-12-01"
    assert data["amount"] == "15000.00"
    assert data["category"] == "Housing"
    assert data["repeat"] == "monthly"


def test_amount_without_category_files_under_other(client):
    assert create(client, amount="20")["category"] == "Other"


def test_category_is_dropped_without_an_amount(client):
    assert create(client, category="Food")["category"] is None


def test_blank_optional_fields_are_none(client):
    data = create(client, due_date="", amount="", category="")
    assert (data["due_date"], data["amount"], data["category"]) == (None, None, None)


def test_list_open_by_date_then_undated_then_done(client):
    undated = create(client, title="Some day")
    later = create(client, title="Later", due_date="2026-12-10")
    sooner = create(client, title="Sooner", due_date="2026-12-01")
    finished = create(client, title="Finished", due_date="2026-11-01")
    complete(client, finished["id"])

    titles = [t["title"] for t in client.get("/api/todos").get_json()]
    assert titles == ["Sooner", "Later", "Some day", "Finished"]
    assert undated["id"] and later["id"] and sooner["id"]


def test_update_replaces_fields(client):
    todo = create(client, title="Pay phone bill", due_date="2026-12-05")

    response = client.put(
        f"/api/todos/{todo['id']}",
        json={"title": "Pay phone bill", "due_date": "2026-12-06", "amount": "499"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["due_date"] == "2026-12-06"
    assert data["amount"] == "499.00"
    assert data["category"] == "Other"


def test_update_done_sets_and_clears_done_at(client):
    todo = create(client)
    url = f"/api/todos/{todo['id']}"

    done = client.put(url, json={"title": todo["title"], "done": True}).get_json()
    assert done["done"] is True
    assert done["done_at"] is not None

    reopened = client.put(url, json={"title": todo["title"], "done": False}).get_json()
    assert reopened["done"] is False
    assert reopened["done_at"] is None


def test_delete(client):
    todo = create(client)
    assert client.delete(f"/api/todos/{todo['id']}").status_code == 204
    assert client.get("/api/todos").get_json() == []


def test_complete_closes_a_one_off_todo(client):
    todo = create(client, due_date="2026-11-22")

    response = complete(client, todo["id"], date="2026-11-22")

    assert response.status_code == 200
    data = response.get_json()
    assert data["expense"] is None
    assert data["todo"]["done"] is True
    assert data["todo"]["done_at"] is not None
    assert client.get("/api/expenses").get_json() == []


def test_complete_with_an_empty_body(client):
    todo = create(client)
    response = client.post(f"/api/todos/{todo['id']}/complete")
    assert response.status_code == 200
    assert response.get_json()["todo"]["done"] is True


def test_complete_can_save_the_payment_as_an_expense(client):
    todo = create(client, title="Electricity", amount="1250.50", category="Utilities")

    response = complete(client, todo["id"], date="2026-11-21", add_expense=True)

    assert response.status_code == 200
    expense = response.get_json()["expense"]
    assert expense["type"] == "expense"
    assert expense["title"] == "Electricity"
    assert expense["amount"] == "1250.50"
    assert expense["category"] == "Utilities"
    assert expense["expense_date"] == "2026-11-21"
    assert [e["id"] for e in client.get("/api/expenses").get_json()] == [expense["id"]]


def test_add_expense_needs_an_amount(client):
    todo = create(client)
    response = complete(client, todo["id"], add_expense=True)
    assert response.status_code == 422
    assert list(response.get_json()["fields"]) == ["add_expense"]
    assert client.get("/api/todos").get_json()[0]["done"] is False


def test_completing_twice_is_a_conflict(client):
    todo = create(client)
    complete(client, todo["id"])
    response = complete(client, todo["id"])
    assert response.status_code == 409
    assert response.get_json() == {"error": "This to-do is already done."}


@pytest.mark.parametrize(
    ("repeat", "due", "expected"),
    [
        ("daily", "2026-11-22", "2026-11-23"),
        ("weekly", "2026-11-28", "2026-12-05"),
        ("monthly", "2026-11-30", "2026-12-30"),
        ("monthly", "2026-12-15", "2027-01-15"),
    ],
)
def test_complete_moves_a_repeating_todo_on(client, repeat, due, expected):
    todo = create(client, due_date=due, repeat=repeat, amount="10")

    data = complete(client, todo["id"], add_expense=True, date=due).get_json()

    assert data["todo"]["done"] is False
    assert data["todo"]["due_date"] == expected
    assert data["expense"]["expense_date"] == due


def test_monthly_uses_the_last_day_of_a_short_month():
    assert next_due(date(2027, 1, 31), "monthly") == date(2027, 2, 28)
    assert next_due(date(2028, 1, 31), "monthly") == date(2028, 2, 29)


def test_todos_are_private(client, other_client):
    todo = create(client)
    url = f"/api/todos/{todo['id']}"

    assert other_client.get("/api/todos").get_json() == []
    assert other_client.put(url, json={"title": "x"}).status_code == 404
    assert other_client.delete(url).status_code == 404
    assert other_client.post(f"{url}/complete", json={}).status_code == 404


def test_needs_a_login(anon_client):
    assert anon_client.get("/api/todos").status_code == 401


@pytest.mark.parametrize("method", ["put", "delete"])
def test_missing_todo_is_404(client, method):
    response = getattr(client, method)("/api/todos/999", json={"title": "x"})
    assert response.status_code == 404
    assert response.get_json() == {"error": "To-do not found."}


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({}, "title"),
        ({"title": "   "}, "title"),
        ({"title": "x" * 121}, "title"),
        ({"title": "x", "due_date": "2026-02-30"}, "due_date"),
        ({"title": "x", "due_date": 20261201}, "due_date"),
        ({"title": "x", "amount": "0"}, "amount"),
        ({"title": "x", "amount": "1.234"}, "amount"),
        ({"title": "x", "amount": "10", "category": "x" * 51}, "category"),
        ({"title": "x", "repeat": "yearly"}, "repeat"),
        ({"title": "x", "repeat": "monthly"}, "repeat"),
        ({"title": "x", "done": "yes"}, "done"),
    ],
)
def test_invalid_todos_are_rejected(client, body, field):
    response = client.post("/api/todos", json=body)
    assert response.status_code == 422
    assert list(response.get_json()["fields"]) == [field]


def test_invalid_completion_date(client):
    todo = create(client)
    response = complete(client, todo["id"], date="not a date")
    assert response.status_code == 422
    assert list(response.get_json()["fields"]) == ["date"]
