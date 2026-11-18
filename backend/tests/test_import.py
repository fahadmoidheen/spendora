"""POST /api/expenses/import - many entries at once, for CSV import."""

import pytest

from app.routes import expenses as expenses_routes

URL = "/api/expenses/import"


def titles(client):
    return sorted(e["title"] for e in client.get("/api/expenses").get_json())


def test_imports_every_row(client, new_expense):
    rows = [
        new_expense(title="Lunch", amount="12.50"),
        new_expense(title="Salary", type="income", amount="3000", category=None),
        new_expense(title="Bus", category="Transport", expense_date="2026-10-02"),
    ]

    response = client.post(URL, json={"entries": rows})

    assert response.status_code == 201
    body = response.get_json()
    assert body["created"] == 3
    assert [e["title"] for e in body["entries"]] == ["Lunch", "Salary", "Bus"]
    assert body["entries"][1]["category"] == "Income"
    assert body["entries"][0]["amount"] == "12.50"
    assert titles(client) == ["Bus", "Lunch", "Salary"]


def test_imported_rows_belong_to_the_importer(client, other_client, new_expense):
    client.post(URL, json={"entries": [new_expense()]})

    assert other_client.get("/api/expenses").get_json() == []


def test_blank_titles_continue_the_count(client, new_expense):
    client.post("/api/expenses", json=new_expense(title=""))  # food1

    response = client.post(
        URL,
        json={"entries": [new_expense(title=""), new_expense(title="  "), new_expense(title=None)]},
    )

    assert [e["title"] for e in response.get_json()["entries"]] == ["food2", "food3", "food4"]


def test_blank_titles_skip_numbers_named_in_the_same_batch(client, new_expense):
    response = client.post(
        URL,
        json={
            "entries": [
                new_expense(title=""),
                new_expense(title="Food9"),
                new_expense(title="", category="Travel"),
            ]
        },
    )

    assert [e["title"] for e in response.get_json()["entries"]] == ["food10", "Food9", "travel1"]


def test_one_bad_row_saves_nothing(client, new_expense):
    rows = [new_expense(), new_expense(amount="-5"), new_expense(expense_date="31/12/2026")]

    response = client.post(URL, json={"entries": rows})

    assert response.status_code == 422
    fields = response.get_json()["fields"]
    assert fields == {
        "entries.1.amount": "Amount must be more than 0.",
        "entries.2.expense_date": "Date must be a real date, as YYYY-MM-DD.",
    }
    assert titles(client) == []


def test_reports_only_the_first_errors(client, new_expense):
    rows = [new_expense(amount="0")] * 50

    fields = client.post(URL, json={"entries": rows}).get_json()["fields"]

    assert len(fields) == expenses_routes.IMPORT_MAX_ERRORS


@pytest.mark.parametrize("body", [{}, {"entries": []}, {"entries": "nope"}, []])
def test_needs_a_list_of_entries(client, body):
    response = client.post(URL, json=body)

    assert response.status_code == 422
    assert "entries" in response.get_json()["fields"]


def test_row_limit(client, new_expense, monkeypatch):
    monkeypatch.setattr(expenses_routes, "IMPORT_MAX_ROWS", 2)

    response = client.post(URL, json={"entries": [new_expense()] * 3})

    assert response.status_code == 422
    assert response.get_json()["fields"]["entries"] == "At most 2 entries per import."
    assert titles(client) == []


def test_needs_a_login(anon_client, new_expense):
    assert anon_client.post(URL, json={"entries": [new_expense()]}).status_code == 401
