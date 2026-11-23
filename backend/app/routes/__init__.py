"""HTTP routes, one blueprint per resource."""

from app.routes.budgets import bp as budgets_bp
from app.routes.expenses import bp as expenses_bp
from app.routes.health import bp as health_bp
from app.routes.index import bp as index_bp
from app.routes.todos import bp as todos_bp


def register_blueprints(app):
    app.register_blueprint(index_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(budgets_bp)
    app.register_blueprint(todos_bp)
