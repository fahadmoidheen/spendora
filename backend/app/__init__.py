"""Application factory for the Spendora API."""

from flask import Flask

from app import models  # noqa: F401 - registers every table with SQLAlchemy
from app.commands import register_commands
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
    register_commands(app)

    if not app.config.get("AUTH0_DOMAIN") or not app.config.get("AUTH0_AUDIENCE"):
        app.logger.warning(
            "Login isn't set up: AUTH0_DOMAIN / AUTH0_AUDIENCE are empty, so "
            "every request for expenses or budgets will be refused (503)."
        )

    return app
