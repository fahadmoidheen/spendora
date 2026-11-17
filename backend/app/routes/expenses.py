"""Expense CRUD endpoints - income entries too (``type: "income"``).

    GET    /api/expenses        list, newest expense date first
    POST   /api/expenses        create -> 201
    GET    /api/expenses/<id>   one expense
    PUT    /api/expenses/<id>   replace every field
    DELETE /api/expenses/<id>   delete -> 204

Bodies are JSON. Invalid input -> 422 with a message per field.
"""

from flask import Blueprint, abort, jsonify, request, url_for
from sqlalchemy import select

from app.extensions import db
from app.models import Expense
from app.validation import validate_expense

bp = Blueprint("expenses", __name__, url_prefix="/api/expenses")


def _json_body():
    payload = request.get_json(silent=True)
    if payload is None:
        abort(400, description="Request body must be JSON.")
    return payload


def _get_expense(expense_id):
    return db.get_or_404(Expense, expense_id, description="Expense not found.")


@bp.get("")
def list_expenses():
    expenses = db.session.scalars(
        select(Expense).order_by(Expense.expense_date.desc(), Expense.id.desc())
    )
    return jsonify([e.to_dict() for e in expenses])


@bp.post("")
def create_expense():
    expense = Expense(**validate_expense(_json_body()))
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
    for field, value in validate_expense(_json_body()).items():
        setattr(expense, field, value)
    db.session.commit()
    return jsonify(expense.to_dict())


@bp.delete("/<int:expense_id>")
def delete_expense(expense_id):
    db.session.delete(_get_expense(expense_id))
    db.session.commit()
    return "", 204
