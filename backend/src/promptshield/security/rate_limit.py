from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from promptshield.security.jwt import TokenError, decode_access_token

# Single shared limiter — imported by main.py (to register the exception handler)
# and by API routers (to decorate specific endpoints).
limiter = Limiter(key_func=get_remote_address)


def user_rate_limit_key(request: Request) -> str:
    """Key authenticated endpoints by user id so users behind one NAT/proxy
    don't share a bucket. Falls back to the client IP when the token is
    missing or invalid — those requests are rejected with 401 anyway."""
    auth = request.headers.get("authorization", "")
    scheme, _, token = auth.partition(" ")
    if scheme.lower() == "bearer" and token:
        try:
            return f"user:{decode_access_token(token).subject}"
        except TokenError:
            pass
    return f"ip:{get_remote_address(request)}"
