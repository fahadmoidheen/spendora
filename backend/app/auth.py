"""Login check for the API, using Auth0 access tokens.

The browser logs in with Auth0 and sends ``Authorization: Bearer <token>``
on every API call. A token is accepted only if:

- Auth0 signed it (RS256, checked against the tenant's published keys),
- it was issued by our tenant (``iss``) for this API (``aud``),
- it hasn't expired, and it names a user (``sub``).

The token's ``sub`` - Auth0's user id, e.g. "google-oauth2|1098..." - becomes
``g.user_id``, and every query on user data filters by it.

No secret is needed: the tenant's public keys are fetched from Auth0 and
cached. Nothing here ever sees a password.
"""

import jwt
from flask import abort, current_app, g, request

ALGORITHMS = ["RS256"]
CLOCK_SKEW_SECONDS = 30


def _issuer():
    return f"https://{current_app.config['AUTH0_DOMAIN']}/"


def _jwks_client():
    # One client per app, so Auth0's public keys are fetched once and reused.
    client = current_app.extensions.get("auth0_jwks")
    if client is None:
        client = jwt.PyJWKClient(f"{_issuer()}.well-known/jwks.json", timeout=5)
        current_app.extensions["auth0_jwks"] = client
    return client


def _signing_key(token):
    # The test suite signs tokens with its own key pair instead of Auth0's.
    # Only honoured in testing mode, so it can't weaken a real deployment.
    if current_app.testing and current_app.config.get("AUTH_TEST_PUBLIC_KEY"):
        return current_app.config["AUTH_TEST_PUBLIC_KEY"]
    return _jwks_client().get_signing_key_from_jwt(token).key


def _bearer_token():
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        abort(401, description="Log in to continue.")
    return token.strip()


def require_login():
    """``before_request`` hook for every blueprint that holds user data."""
    config = current_app.config
    if not config.get("AUTH0_DOMAIN") or not config.get("AUTH0_AUDIENCE"):
        abort(
            503,
            description="Login isn't set up yet: add AUTH0_DOMAIN and "
            "AUTH0_AUDIENCE to backend/.env (see README, 'Login').",
        )

    token = _bearer_token()
    try:
        claims = jwt.decode(
            token,
            _signing_key(token),
            algorithms=ALGORITHMS,
            audience=config["AUTH0_AUDIENCE"],
            issuer=_issuer(),
            leeway=CLOCK_SKEW_SECONDS,
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        abort(401, description="Your session has expired. Log in again.")
    except jwt.PyJWKClientConnectionError as exc:
        current_app.logger.warning("Couldn't fetch Auth0 signing keys: %s", exc)
        abort(503, description="Couldn't reach Auth0 to check your login. Try again.")
    except (jwt.PyJWKClientError, jwt.InvalidTokenError) as exc:
        # Log why (never the token itself) - the user only sees a generic
        # message, so this is where a misconfiguration shows up.
        current_app.logger.warning("Rejected login token: %s: %s", type(exc).__name__, exc)
        abort(401, description="Your login couldn't be verified. Log in again.")

    if not isinstance(claims["sub"], str) or not claims["sub"]:
        abort(401, description="Your login couldn't be verified. Log in again.")
    g.user_id = claims["sub"]
