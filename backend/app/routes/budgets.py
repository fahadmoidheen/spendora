"""Budget CRUD endpoints - one monthly spending limit per category.

    GET    /api/budgets        list, by category name
    POST   /api/budgets        create -> 201 (409 if the category has one)
    PUT    /api/budgets/<id>   replace category and limit
    DELETE /api/budgets/<id>   delete -> 204

How much of a budget is used is worked out by the client from the
month's expenses, so these endpoints only store the limits.

Every request needs a login (app/auth.py) and only ever sees the logged-in
user's budgets; someone else's budget answers 404.
"""

from flask import Blueprint, abort, g, jsonify, request, url_for
from sqlalchemy import select

from app.auth import require_login
from app.extensions import db
from app.models import Budget
from app.validation import validate_budget

bp = Blueprint("budgets", __name__, url_prefix="/api/budgets")
bp.before_request(require_login)


def _json_body():
    payload = request.get_json(silent=True)
    if payload is None:
        abort(400, description="Request body must be JSON.")
    return payload


def _mine():
    return select(Budget).where(Budget.user_id == g.user_id)


def _get_budget(budget_id):
    budget = db.session.scalar(_mine().where(Budget.id == budget_id))
    if budget is None:
        abort(404, description="Budget not found.")
    return budget


def _ensure_category_free(category, except_id=None):
    existing = db.session.scalar(_mine().where(Budget.category == category))
    if existing and existing.id != except_id:
        abort(409, description=f"There is already a budget for {category}.")


@bp.get("")
def list_budgets():
    budgets = db.session.scalars(_mine().order_by(Budget.category))
    return jsonify([b.to_dict() for b in budgets])


@bp.post("")
def create_budget():
    data = validate_budget(_json_body())
    _ensure_category_free(data["category"])
    budget = Budget(**data, user_id=g.user_id)
    db.session.add(budget)
    db.session.commit()
    location = url_for(".update_budget", budget_id=budget.id)
    return jsonify(budget.to_dict()), 201, {"Location": location}


@bp.put("/<int:budget_id>")
def update_budget(budget_id):
    budget = _get_budget(budget_id)
    data = validate_budget(_json_body())
    _ensure_category_free(data["category"], except_id=budget.id)
    for field, value in data.items():
        setattr(budget, field, value)
    db.session.commit()
    return jsonify(budget.to_dict())


@bp.delete("/<int:budget_id>")
def delete_budget(budget_id):
    db.session.delete(_get_budget(budget_id))
    db.session.commit()
    return "", 204
