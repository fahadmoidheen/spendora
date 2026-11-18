"""JSON error responses.

This is an API-only app, so every error - a bad request, a missing
expense, an unknown URL, an unexpected crash - comes back as JSON shaped
``{"error": "<message>"}``. Validation failures add ``"fields"``.
"""

from flask import jsonify
from werkzeug.exceptions import HTTPException


class ValidationError(Exception):
    """Raised when a request body fails validation."""

    def __init__(self, fields: dict[str, str]):
        super().__init__("Validation failed.")
        self.fields = fields


def register_error_handlers(app):
    @app.errorhandler(ValidationError)
    def handle_validation_error(err):
        return jsonify(error="Validation failed.", fields=err.fields), 422

    # Also receives unhandled exceptions, wrapped by Flask as a 500.
    @app.errorhandler(HTTPException)
    def handle_http_error(err):
        response = jsonify(error=err.description)
        if err.code == 401:
            # Standard hint that the API expects a bearer token.
            response.headers["WWW-Authenticate"] = 'Bearer realm="spendora"'
        return response, err.code
