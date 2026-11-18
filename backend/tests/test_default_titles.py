"""Entries saved without a title get one from their category: food1, food2..."""

import pytest


def create(client, body):
    response = client.post("/api/expenses", json=body)
    assert response.status_code == 201, response.get_json()
    return response.get_json()


@pytest.mark.parametrize("blank", ["", "   ", None])
def test_blank_title_is_named_after_the_category(client, new_expense, blank):
    assert create(client, new_expense(title=blank))["title"] == "food1"


def test_missing_title_key_works_too(client, new_expense):
    body = new_expense()
    del body["title"]
    assert create(client, body)["title"] == "food1"


def test_numbers_go_up_per_category(client, new_expense):
    titles = [
        create(client, new_expense(title="", category="Food"))["title"],
        create(client, new_expense(title="", category="Food"))["title"],
        create(client, new_expense(title="", category="Entertainment"))["title"],
        create(client, new_expense(title="", category="Food"))["title"],
    ]
    assert titles == ["food1", "food2", "entertainment1", "food3"]


def test_income_without_a_source_is_income1(client, new_expense):
    body = new_expense(type="income", title="")
    del body["category"]
    assert create(client, body)["title"] == "income1"


def test_number_follows_the_highest_even_after_a_delete(client, new_expense):
    first = create(client, new_expense(title=""))
    create(client, new_expense(title=""))  # food2
    client.delete(f"/api/expenses/{first['id']}")

    # food1 is free again, but reusing it could be confusing - carry on.
    assert create(client, new_expense(title=""))["title"] == "food3"


def test_hand_typed_names_count_in_any_case(client, new_expense):
    create(client, new_expense(title="Food5"))
    create(client, new_expense(title="food bill"))  # not "food<number>"
    assert create(client, new_expense(title=""))["title"] == "food6"


def test_categories_with_spaces_lose_them(client, new_expense):
    assert create(client, new_expense(title="", category="Pet Care"))["title"] == "petcare1"


def test_numbering_is_per_user(client, other_client, new_expense):
    create(client, new_expense(title=""))
    create(client, new_expense(title=""))
    assert create(other_client, new_expense(title=""))["title"] == "food1"


def test_clearing_the_title_on_edit_renames_without_counting_itself(client, new_expense):
    create(client, new_expense(title=""))  # food1
    entry = create(client, new_expense(title=""))  # food2

    response = client.put(f"/api/expenses/{entry['id']}", json=new_expense(title=""))

    assert response.get_json()["title"] == "food2"


def test_clearing_the_title_after_changing_category(client, new_expense):
    entry = create(client, new_expense(title="Lunch"))

    response = client.put(
        f"/api/expenses/{entry['id']}", json=new_expense(title="", category="Travel")
    )

    assert response.get_json()["title"] == "travel1"
