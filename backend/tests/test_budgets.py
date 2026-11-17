"""Tests for the /api/budgets endpoints."""

import pytest


def create(client, category="Food", limit="450.00"):
    response = client.post(
        "/api/budgets", json={"category": category, "monthly_limit": limit}
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def test_list_starts_empty(client):
    assert client.get("/api/budgets").get_json() == []


def test_create_returns_the_budget(client):
    response = client.post(
        "/api/budgets", json={"category": " Food ", "monthly_limit": 450}
    )

    assert response.status_code == 201
    data = response.get_json()
    assert data["category"] == "Food"
    assert data["monthly_limit"] == "450.00"
    assert response.headers["Location"] == f"/api/budgets/{data['id']}"


def test_list_is_sorted_by_category(client):
    create(client, "Travel")
    create(client, "Food")
    create(client, "Housing")
    categories = [b["category"] for b in client.get("/api/budgets").get_json()]
    assert categories == ["Food", "Housing", "Travel"]


def test_one_budget_per_category(client):
    create(client, "Food")
    response = client.post("/api/budgets", json={"category": "Food", "monthly_limit": "10"})
    assert response.status_code == 409
    assert response.get_json() == {"error": "There is already a budget for Food."}


def test_update_changes_the_limit(client):
    budget = create(client, "Food", "450.00")

    response = client.put(
        f"/api/budgets/{budget['id']}", json={"category": "Food", "monthly_limit": "500"}
    )

    assert response.status_code == 200
    assert response.get_json()["monthly_limit"] == "500.00"


def test_update_cannot_take_another_budgets_category(client):
    create(client, "Food")
    travel = create(client, "Travel")

    response = client.put(
        f"/api/budgets/{travel['id']}", json={"category": "Food", "monthly_limit": "50"}
    )

    assert response.status_code == 409


def test_delete(client):
    budget = create(client)
    assert client.delete(f"/api/budgets/{budget['id']}").status_code == 204
    assert client.get("/api/budgets").get_json() == []


@pytest.mark.parametrize("method", ["put", "delete"])
def test_missing_budget_is_404(client, method):
    response = getattr(client, method)(
        "/api/budgets/999", json={"category": "Food", "monthly_limit": "1"}
    )
    assert response.status_code == 404
    assert response.get_json() == {"error": "Budget not found."}


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"category": "", "monthly_limit": "10"}, "category"),
        ({"category": "x" * 51, "monthly_limit": "10"}, "category"),
        ({"category": "Food", "monthly_limit": "0"}, "monthly_limit"),
        ({"category": "Food", "monthly_limit": "-1"}, "monthly_limit"),
        ({"category": "Food", "monthly_limit": "1.234"}, "monthly_limit"),
        ({"category": "Food", "monthly_limit": "abc"}, "monthly_limit"),
        ({"category": "Food"}, "monthly_limit"),
    ],
)
def test_invalid_budgets_are_rejected(client, body, field):
    response = client.post("/api/budgets", json=body)
    assert response.status_code == 422
    assert list(response.get_json()["fields"]) == [field]
