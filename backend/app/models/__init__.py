"""Model package.

Every model must be imported here. Importing the module is what registers
the class in SQLAlchemy's metadata - and Flask-Migrate can only generate a
migration for tables it finds in that metadata.
"""

from app.models.budget import Budget
from app.models.expense import Expense
from app.models.todo import Todo

__all__ = ["Budget", "Expense", "Todo"]
