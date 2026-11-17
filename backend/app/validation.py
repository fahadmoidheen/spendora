"""Request validation for expenses (income included) and budgets.

Rules match the models, so anything the database would reject is caught
here first with a readable message per field.
"""

from datetime import date
from decimal import Decimal, InvalidOperation

from app.errors import ValidationError
from app.models.expense import TYPES

TITLE_MAX = 120  # String(120)
CATEGORY_MAX = 50  # String(50)
AMOUNT_MAX = Decimal("99999999.99")  # Numeric(10, 2)
CENT = Decimal("0.01")
INCOME_CATEGORY = "Income"


def _required_text(value, label, max_length):
    if not isinstance(value, str) or not value.strip():
        return None, f"{label} is required."
    value = value.strip()
    if len(value) > max_length:
        return None, f"{label} must be at most {max_length} characters."
    return value, None


def _money(value, label):
    # bool is a subclass of int in Python - don't let true become 1.00.
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return None, f"{label} must be a number."
    try:
        amount = Decimal(str(value).strip())
    except InvalidOperation:
        return None, f"{label} must be a number."
    if not amount.is_finite():
        return None, f"{label} must be a number."
    if amount <= 0:
        return None, f"{label} must be more than 0."
    if amount > AMOUNT_MAX:
        return None, f"{label} must be at most {AMOUNT_MAX}."
    if amount != amount.quantize(CENT):
        return None, f"{label} can have at most 2 decimal places."
    return amount.quantize(CENT), None


def _type(value):
    if value is None:
        return "expense", None
    if value not in TYPES:
        return None, 'Type must be "expense" or "income".'
    return value, None


def _expense_date(value):
    if not isinstance(value, str):
        return None, "Date is required, as YYYY-MM-DD."
    try:
        return date.fromisoformat(value.strip()), None
    except ValueError:
        return None, "Date must be a real date, as YYYY-MM-DD."


def _description(value):
    if value is None:
        return None, None
    if not isinstance(value, str):
        return None, "Description must be text."
    # Blank notes are stored as NULL, not "".
    return value.strip() or None, None


def _require_object(payload):
    if not isinstance(payload, dict):
        raise ValidationError({"body": "Expected a JSON object."})


def _collect(checks):
    errors = {field: error for field, (_, error) in checks.items() if error}
    if errors:
        raise ValidationError(errors)
    return {field: value for field, (value, _) in checks.items()}


def validate_expense(payload) -> dict:
    """Return clean column values for an Expense, or raise ValidationError.

    ``type`` defaults to "expense". Income needs no category - it is stored
    as "Income". Everything else is required except ``description``, so
    the same rules serve create (POST) and full replace (PUT). Unknown keys
    are ignored.
    """
    _require_object(payload)

    kind, kind_error = _type(payload.get("type"))
    category = payload.get("category")
    if kind == "income" and not (isinstance(category, str) and category.strip()):
        category = INCOME_CATEGORY

    return _collect({
        "type": (kind, kind_error),
        "title": _required_text(payload.get("title"), "Title", TITLE_MAX),
        "amount": _money(payload.get("amount"), "Amount"),
        "category": _required_text(category, "Category", CATEGORY_MAX),
        "expense_date": _expense_date(payload.get("expense_date")),
        "description": _description(payload.get("description")),
    })


def validate_budget(payload) -> dict:
    """Return clean column values for a Budget, or raise ValidationError."""
    _require_object(payload)
    return _collect({
        "category": _required_text(payload.get("category"), "Category", CATEGORY_MAX),
        "monthly_limit": _money(payload.get("monthly_limit"), "Monthly limit"),
    })
