"""Expense CRUD endpoints - income entries too (``type: "income"``).

    GET    /api/expenses          list, newest expense date first
    POST   /api/expenses          create -> 201
    POST   /api/expenses/import   create many at once (CSV import) -> 201
    GET    /api/expenses/<id>     one expense
    PUT    /api/expenses/<id>     replace every field
    DELETE /api/expenses/<id>     delete -> 204

Bodies are JSON. Invalid input -> 422 with a message per field. A blank
title is filled in from the category: "food1", "food2", "income1", ...

Every request needs a login (app/auth.py) and only ever sees the logged-in
user's entries. Someone else's entry answers 404, exactly like one that
doesn't exist, so ids can't be probed.
"""

import re

from flask import Blueprint, abort, g, jsonify, request, url_for
from sqlalchemy import select

from app.auth import require_login
from app.errors import ValidationError
from app.extensions import db
from app.models import Expense
from app.validation import validate_expense

bp = Blueprint("expenses", __name__, url_prefix="/api/expenses")
bp.before_request(require_login)

IMPORT_MAX_ROWS = 5000
IMPORT_MAX_ERRORS = 20  # report the first few bad rows, not thousands


def _title_base(category):
    return re.sub(r"\s+", "", category).lower()


def _title_number(base, title):
    """5 for ("food", "Food5"); None when the title isn't base + number."""
    match = re.fullmatch(rf"{re.escape(base)}([0-9]+)", title or "", re.IGNORECASE)
    return int(match.group(1)) if match else None


def _highest_number(base, exclude_id=None):
    query = select(Expense.title).where(
        Expense.user_id == g.user_id,
        Expense.title.regexp_match(rf"^{re.escape(base)}[0-9]+$", flags="i"),
    )
    if exclude_id is not None:
        query = query.where(Expense.id != exclude_id)
    return max((_title_number(base, t) for t in db.session.scalars(query)), default=0)


def _default_title(category, exclude_id=None):
    """Name for an entry saved without a title: "food1", "food2", ...

    The number is one more than the highest this user already has for that
    name (in any case, e.g. "Food5" counts), so names stay unique even
    after deletions. ``exclude_id`` leaves out the entry being edited.
    """
    base = _title_base(category)
    return f"{base}{_highest_number(base, exclude_id) + 1}"


def _fill_default_titles(rows):
    """Name every untitled row in a batch, continuing each category's count.

    Hand-typed names in the same batch ("Food9") count too, so the numbers
    never collide.
    """
    next_number = {}
    for data in rows:
        if data["title"] is not None:
            continue
        base = _title_base(data["category"])
        if base not in next_number:
            in_batch = (_title_number(base, r["title"]) or 0 for r in rows)
            next_number[base] = max([_highest_number(base), *in_batch]) + 1
        data["title"] = f"{base}{next_number[base]}"
        next_number[base] += 1


def _validated(payload, exclude_id=None):
    data = validate_expense(payload)
    if data["title"] is None:
        data["title"] = _default_title(data["category"], exclude_id)
    return data


def _json_body():
    payload = request.get_json(silent=True)
    if payload is None:
        abort(400, description="Request body must be JSON.")
    return payload


def _mine():
    return select(Expense).where(Expense.user_id == g.user_id)


def _get_expense(expense_id):
    expense = db.session.scalar(_mine().where(Expense.id == expense_id))
    if expense is None:
        abort(404, description="Expense not found.")
    return expense


@bp.get("")
def list_expenses():
    expenses = db.session.scalars(
        _mine().order_by(Expense.expense_date.desc(), Expense.id.desc())
    )
    return jsonify([e.to_dict() for e in expenses])


@bp.post("")
def create_expense():
    expense = Expense(**_validated(_json_body()), user_id=g.user_id)
    db.session.add(expense)
    db.session.commit()
    location = url_for(".get_expense", expense_id=expense.id)
    return jsonify(expense.to_dict()), 201, {"Location": location}


@bp.post("/import")
def import_expenses():
    """Save many entries in one go: ``{"entries": [<expense>, ...]}``.

    All or nothing - if any row is invalid, nothing is saved and the 422
    names the bad rows as "entries.<index>.<field>" (index from 0).
    """
    payload = _json_body()
    rows = payload.get("entries") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not rows:
        raise ValidationError({"entries": "Send a non-empty list of entries."})
    if len(rows) > IMPORT_MAX_ROWS:
        raise ValidationError({"entries": f"At most {IMPORT_MAX_ROWS} entries per import."})

    clean, errors = [], {}
    for index, row in enumerate(rows):
        try:
            clean.append(validate_expense(row))
        except ValidationError as err:
            for field, message in err.fields.items():
                errors[f"entries.{index}.{field}"] = message
            if len(errors) >= IMPORT_MAX_ERRORS:
                break
    if errors:
        raise ValidationError(errors)

    _fill_default_titles(clean)
    expenses = [Expense(**data, user_id=g.user_id) for data in clean]
    db.session.add_all(expenses)
    db.session.commit()
    return jsonify(created=len(expenses), entries=[e.to_dict() for e in expenses]), 201


@bp.get("/<int:expense_id>")
def get_expense(expense_id):
    return jsonify(_get_expense(expense_id).to_dict())


@bp.put("/<int:expense_id>")
def update_expense(expense_id):
    expense = _get_expense(expense_id)
    for field, value in _validated(_json_body(), exclude_id=expense.id).items():
        setattr(expense, field, value)
    db.session.commit()
    return jsonify(expense.to_dict())


@bp.delete("/<int:expense_id>")
def delete_expense(expense_id):
    db.session.delete(_get_expense(expense_id))
    db.session.commit()
    return "", 204
