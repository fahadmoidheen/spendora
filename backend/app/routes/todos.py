"""To-do endpoints - tasks for a day, some of them payments.

    GET    /api/todos                 open to-dos by date, then recent done
    POST   /api/todos                 create -> 201
    PUT    /api/todos/<id>            replace every field
    DELETE /api/todos/<id>            delete -> 204
    POST   /api/todos/<id>/complete   mark done; can save the amount as an
                                      expense in the same step

Completing a repeating to-do moves it to its next date instead of
closing it. Every request needs a login (app/auth.py) and only ever sees
the logged-in user's to-dos; someone else's answers 404.
"""

import calendar
from datetime import date, datetime, timedelta, timezone

from flask import Blueprint, abort, g, jsonify, request, url_for
from sqlalchemy import select

from app.auth import require_login
from app.errors import ValidationError
from app.extensions import db
from app.models import Expense, Todo
from app.validation import validate_completion, validate_todo

bp = Blueprint("todos", __name__, url_prefix="/api/todos")
bp.before_request(require_login)

DONE_LISTED = 50  # only the most recent done to-dos are sent back


def next_due(day, repeat):
    """The date after ``day`` for a repeating to-do.

    Monthly keeps the day of the month, or uses the last day of a shorter
    month (31 Jan -> 28 Feb).
    """
    if repeat == "daily":
        return day + timedelta(days=1)
    if repeat == "weekly":
        return day + timedelta(weeks=1)
    year, month = (day.year + 1, 1) if day.month == 12 else (day.year, day.month + 1)
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def _now():
    return datetime.now(timezone.utc)


def _json_body():
    payload = request.get_json(silent=True)
    if payload is None:
        abort(400, description="Request body must be JSON.")
    return payload


def _mine():
    return select(Todo).where(Todo.user_id == g.user_id)


def _get_todo(todo_id):
    todo = db.session.scalar(_mine().where(Todo.id == todo_id))
    if todo is None:
        abort(404, description="To-do not found.")
    return todo


@bp.get("")
def list_todos():
    open_todos = db.session.scalars(
        _mine()
        .where(Todo.done.is_(False))
        .order_by(Todo.due_date.asc().nulls_last(), Todo.id)
    )
    done_todos = db.session.scalars(
        _mine()
        .where(Todo.done.is_(True))
        .order_by(Todo.done_at.desc().nulls_last(), Todo.id.desc())
        .limit(DONE_LISTED)
    )
    return jsonify([t.to_dict() for t in [*open_todos, *done_todos]])


@bp.post("")
def create_todo():
    data = validate_todo(_json_body())
    todo = Todo(**data, user_id=g.user_id, done_at=_now() if data["done"] else None)
    db.session.add(todo)
    db.session.commit()
    location = url_for(".update_todo", todo_id=todo.id)
    return jsonify(todo.to_dict()), 201, {"Location": location}


@bp.put("/<int:todo_id>")
def update_todo(todo_id):
    todo = _get_todo(todo_id)
    data = validate_todo(_json_body())
    was_done = todo.done
    for field, value in data.items():
        setattr(todo, field, value)
    if not todo.done:
        todo.done_at = None
    elif not was_done:
        todo.done_at = _now()
    db.session.commit()
    return jsonify(todo.to_dict())


@bp.delete("/<int:todo_id>")
def delete_todo(todo_id):
    db.session.delete(_get_todo(todo_id))
    db.session.commit()
    return "", 204


@bp.post("/<int:todo_id>/complete")
def complete_todo(todo_id):
    """Mark a to-do done: ``{"date": "YYYY-MM-DD", "add_expense": true}``.

    Both fields are optional. With ``add_expense`` the to-do's amount is
    saved as an expense dated ``date`` (default: the server's today), in
    the same transaction. Answers ``{"todo": ..., "expense": ... | null}``.
    """
    todo = _get_todo(todo_id)
    data = validate_completion(request.get_json(silent=True))
    if todo.done:
        abort(409, description="This to-do is already done.")
    if data["add_expense"] and todo.amount is None:
        raise ValidationError({"add_expense": "This to-do has no amount to save."})

    on = data["date"] or date.today()
    expense = None
    if data["add_expense"]:
        expense = Expense(
            user_id=g.user_id,
            type="expense",
            title=todo.title,
            amount=todo.amount,
            category=todo.category or "Other",
            expense_date=on,
        )
        db.session.add(expense)

    if todo.repeat == "none":
        todo.done = True
        todo.done_at = _now()
    else:
        todo.due_date = next_due(todo.due_date or on, todo.repeat)

    db.session.commit()
    return jsonify(todo=todo.to_dict(), expense=expense.to_dict() if expense else None)
