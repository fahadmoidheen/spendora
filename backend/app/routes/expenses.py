"""Expense CRUD endpoints - income entries too (``type: "income"``).

    GET    /api/expenses        list, newest expense date first
    POST   /api/expenses        create -> 201
    GET    /api/expenses/<id>   one expense
    PUT    /api/expenses/<id>   replace every field
    DELETE /api/expenses/<id>   delete -> 204

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
from app.extensions import db
from app.models import Expense
from app.validation import validate_expense

bp = Blueprint("expenses", __name__, url_prefix="/api/expenses")
bp.before_request(require_login)


def _default_title(category, exclude_id=None):
    """Name for an entry saved without a title: "food1", "food2", ...

    The number is one more than the highest this user already has for that
    name (in any case, e.g. "Food5" counts), so names stay unique even
    after deletions. ``exclude_id`` leaves out the entry being edited.
    """
    base = re.sub(r"\s+", "", category).lower()
    pattern = rf"^{re.escape(base)}([0-9]+)$"
    query = select(Expense.title).where(
        Expense.user_id == g.user_id,
        Expense.title.regexp_match(pattern, flags="i"),
    )
    if exclude_id is not None:
        query = query.where(Expense.id != exclude_id)
    used = [
        int(match.group(1))
        for title in db.session.scalars(query)
        if (match := re.match(pattern, title, re.IGNORECASE))
    ]
    return f"{base}{max(used, default=0) + 1}"


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
