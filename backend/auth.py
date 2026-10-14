"""Demo access control for the deployed backend. Off when DEMO_PASSWORD is unset (local dev).

A password is exchanged at POST /api/login for a short-lived signed token (stateless HMAC, nothing stored).
Unlike a key baked into the UI bundle, the password never ships in the page. Gmail actions also need
ADMIN_KEY, which the operator types in the UI at use time.
"""
import hashlib
import hmac
import os
import time

TOKEN_TTL_S = 12 * 3600


def auth_required() -> bool:
    return bool(os.getenv("DEMO_PASSWORD"))


def _secret() -> bytes:
    return (os.getenv("AUTH_SECRET") or os.getenv("DEMO_PASSWORD", "")).encode()


def _sign(expires: int) -> str:
    return hmac.new(_secret(), str(expires).encode(), hashlib.sha256).hexdigest()


def password_ok(given: str) -> bool:
    return auth_required() and hmac.compare_digest(given.encode(), os.environ["DEMO_PASSWORD"].encode())


def make_token(now: float | None = None) -> str:
    expires = int((time.time() if now is None else now) + TOKEN_TTL_S)
    return f"{expires}.{_sign(expires)}"


def token_ok(token: str, now: float | None = None) -> bool:
    expires, _, sig = token.partition(".")
    if not expires.isdigit() or int(expires) < (time.time() if now is None else now):
        return False
    return hmac.compare_digest(sig.encode(), _sign(int(expires)).encode())


def admin_ok(given: str) -> bool:
    """Gmail actions. With auth on, ADMIN_KEY must be configured and match; with auth off (local) they are open."""
    key = os.getenv("ADMIN_KEY", "")
    if not auth_required():
        return not key or hmac.compare_digest(given.encode(), key.encode())
    return bool(key) and hmac.compare_digest(given.encode(), key.encode())
