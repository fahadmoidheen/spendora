"""The Expense model - one row per money movement.

Despite the name (kept so the table, model and /api/expenses URL stay
stable), a row is either money out (``type="expense"``) or money in
(``type="income"``). Income rows use the category "Income".
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, Index, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


TYPES = ("expense", "income")

# Auth0 user ids are like "google-oauth2|103547991597142817347".
USER_ID_LENGTH = 128


class Expense(db.Model):
    """A single expense or income entry, owned by one user."""

    __tablename__ = "expenses"
    __table_args__ = (
        # Enforced by PostgreSQL itself, not just by application code.
        CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),
        CheckConstraint("type IN ('expense', 'income')", name="ck_expenses_type"),
        # Every list query is "this user's entries, newest first".
        Index("ix_expenses_user_id_expense_date", "user_id", "expense_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    # Owner: the Auth0 user id (the token's "sub"). See app/auth.py.
    user_id: Mapped[str] = mapped_column(String(USER_ID_LENGTH))

    type: Mapped[str] = mapped_column(
        String(10), default="expense", server_default="expense", index=True
    )
    title: Mapped[str] = mapped_column(String(120))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    category: Mapped[str] = mapped_column(String(50), index=True)
    expense_date: Mapped[date] = mapped_column(Date, index=True)

    description: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    def to_dict(self) -> dict:
        """JSON-ready form returned by the API.

        ``amount`` is a string ("12.50"), not a float, so no precision is
        lost on the way to the client. Dates are ISO 8601 strings.
        """
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "amount": f"{self.amount:.2f}",
            "category": self.category,
            "expense_date": self.expense_date.isoformat(),
            "description": self.description,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self) -> str:
        return f"<Expense id={self.id} {self.title!r} {self.amount}>"
