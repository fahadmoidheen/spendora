"""The Budget model - a monthly spending limit for one category.

A budget repeats every calendar month; how much of it is used is worked
out from that month's expenses in the same category.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class Budget(db.Model):
    __tablename__ = "budgets"
    __table_args__ = (
        CheckConstraint("monthly_limit > 0", name="ck_budgets_limit_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    # One budget per category.
    category: Mapped[str] = mapped_column(String(50), unique=True)
    monthly_limit: Mapped[Decimal] = mapped_column(Numeric(10, 2))

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
        """JSON-ready form; ``monthly_limit`` is a string like "450.00"."""
        return {
            "id": self.id,
            "category": self.category,
            "monthly_limit": f"{self.monthly_limit:.2f}",
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self) -> str:
        return f"<Budget {self.category!r} {self.monthly_limit}>"
