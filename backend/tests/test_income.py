"""Income entries: the same /api/expenses endpoints with type "income"."""

import pytest


def test_type_defaults_to_expense(client, new_expense):
    data = client.post("/api/expenses", json=new_expense()).get_json()
    assert data["type"] == "expense"


def test_income_without_category_is_filed_under_income(client, new_expense):
    body = new_expense(type="income", title="Salary", amount="5200.00")
    del body["category"]

    response = client.post("/api/expenses", json=body)

    assert response.status_code == 201
    data = response.get_json()
    assert data["type"] == "income"
    assert data["category"] == "Income"
    assert data["amount"] == "5200.00"


def test_income_keeps_a_category_if_given(client, new_expense):
    data = client.post(
        "/api/expenses", json=new_expense(type="income", category="Freelance")
    ).get_json()
    assert data["category"] == "Freelance"


def test_expense_still_needs_a_category(client, new_expense):
    response = client.post("/api/expenses", json=new_expense(category=""))
    assert response.status_code == 422
    assert list(response.get_json()["fields"]) == ["category"]


@pytest.mark.parametrize("bad", ["refund", "", 1, True])
def test_unknown_type_is_rejected(client, new_expense, bad):
    response = client.post("/api/expenses", json=new_expense(type=bad))
    assert response.status_code == 422
    assert list(response.get_json()["fields"]) == ["type"]


def test_update_can_switch_type(client, new_expense):
    created = client.post("/api/expenses", json=new_expense()).get_json()

    response = client.put(
        f"/api/expenses/{created['id']}",
        json=new_expense(type="income", title="Refund", category=None),
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["type"] == "income"
    assert data["category"] == "Income"
