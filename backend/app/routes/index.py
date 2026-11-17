"""Root URL: says what this server is and where the endpoints are.

Opening http://127.0.0.1:5001/ in a browser used to give a bare 404,
which looked like the server was down.
"""

from flask import Blueprint, jsonify

bp = Blueprint("index", __name__)


@bp.get("/")
def index():
    return jsonify(
        name="Spendora API",
        status="running",
        endpoints={
            "health": "/api/health",
            "expenses": "/api/expenses",
            "budgets": "/api/budgets",
        },
    )
