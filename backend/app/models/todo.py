"""The Todo model - a task for a day, optionally a payment.

A to-do with an amount is a planned payment (rent, a bill): marking it
done can save it as an expense in the same step. A repeating to-do moves
to its next date when it's done, instead of closing.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Index,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db
from app.models.expense import USER_ID_LENGTH

REPEATS = ("none", "daily", "weekly", "monthly")


class Todo(db.Model):
    __tablename__ = "todos"
    __table_args__ = (
        CheckConstraint("amount IS NULL OR amount > 0", name="ck_todos_amount_positive"),
        CheckConstraint(
            "repeat IN ('none', 'daily', 'weekly', 'monthly')", name="ck_todos_repeat"
        ),
        # Lists are "this user's to-dos, by date".
        Index("ix_todos_user_id_due_date", "user_id", "due_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    # Owner: the Auth0 user id (the token's "sub"). See app/auth.py.
    user_id: Mapped[str] = mapped_column(String(USER_ID_LENGTH))

    title: Mapped[str] = mapped_column(String(120))
    # No date = "some time"; it never shows up as due today.
    due_date: Mapped[date | None] = mapped_column(Date)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    # Only used with an amount: the category the expense is filed under.
    category: Mapped[str | None] = mapped_column(String(50))
    repeat: Mapped[str] = mapped_column(String(10), default="none", server_default="none")

    done: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

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
        """JSON-ready form; ``amount`` is a string like "15000.00" or None."""
        return {
            "id": self.id,
            "title": self.title,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "amount": f"{self.amount:.2f}" if self.amount is not None else None,
            "category": self.category,
            "repeat": self.repeat,
            "done": self.done,
            "done_at": self.done_at.isoformat() if self.done_at else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self) -> str:
        return f"<Todo id={self.id} {self.title!r} due={self.due_date}>"
