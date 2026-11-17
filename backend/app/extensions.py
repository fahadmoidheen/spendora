"""Shared Flask extension instances.

These objects are created here, unbound to any application, so that both
the application factory and the model modules can import them without
forming a circular import. Each one is attached to a concrete app inside
``create_app()`` via its ``init_app()`` method.
"""

from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base class that every model will inherit from."""


db = SQLAlchemy(model_class=Base)

# Schema changes go through Alembic migrations (``flask db migrate`` /
# ``flask db upgrade``), never ``db.create_all()``, outside of tests.
migrate = Migrate()
