"""WSGI entry point.

Used by the Flask CLI in development (``flask run``) and by Gunicorn in
production (``gunicorn wsgi:app``).
"""

from app import create_app

app = create_app()
