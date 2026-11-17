"""Application factory for the Spendora API."""

from flask import Flask

from app import models  # noqa: F401 - registers every table with SQLAlchemy
from app.config import get_config
from app.errors import register_error_handlers
from app.extensions import db, migrate
from app.routes import register_blueprints


def create_app(config_name=None):
    """Build and return a configured Flask application instance."""
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))

    # Bind extensions to this specific application instance.
    db.init_app(app)
    migrate.init_app(app, db)

    register_blueprints(app)
    register_error_handlers(app)

    return app
