from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from promptshield.config import get_settings


class TokenError(Exception):
    """Raised when a token is invalid, expired, or of the wrong type."""


@dataclass
class DecodedToken:
    subject: str
    typ: str
    jti: str | None
    exp: datetime
    iat: datetime
    ver: int


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _encode(payload: dict[str, Any]) -> str:
    s = get_settings()
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_alg)


def _decode(token: str) -> dict[str, Any]:
    s = get_settings()
    try:
        return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_alg])
    except JWTError as exc:
        raise TokenError(str(exc)) from exc


def create_access_token(subject: str | uuid.UUID, token_version: int = 0) -> str:
    s = get_settings()
    now = _now()
    exp = now + timedelta(minutes=s.access_token_ttl_min)
    payload = {
        "sub": str(subject),
        "typ": "access",
        "ver": token_version,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return _encode(payload)


def create_refresh_token(subject: str | uuid.UUID) -> tuple[str, str]:
    """Return (encoded_jwt, jti). The caller must persist SHA-256(jti) in refresh_tokens."""
    s = get_settings()
    now = _now()
    exp = now + timedelta(days=s.refresh_token_ttl_days)
    jti = str(uuid.uuid4())
    payload = {
        "sub": str(subject),
        "typ": "refresh",
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return _encode(payload), jti


def refresh_token_expiry() -> datetime:
    s = get_settings()
    return _now() + timedelta(days=s.refresh_token_ttl_days)


def hash_jti(jti: str) -> str:
    return hashlib.sha256(jti.encode("utf-8")).hexdigest()


def decode_access_token(token: str) -> DecodedToken:
    payload = _decode(token)
    if payload.get("typ") != "access":
        raise TokenError("Not an access token")
    return _to_decoded(payload)


def decode_refresh_token(token: str) -> DecodedToken:
    payload = _decode(token)
    if payload.get("typ") != "refresh":
        raise TokenError("Not a refresh token")
    if not payload.get("jti"):
        raise TokenError("Refresh token missing jti")
    return _to_decoded(payload)


def _to_decoded(payload: dict[str, Any]) -> DecodedToken:
    sub = payload.get("sub")
    if not sub:
        raise TokenError("Token missing subject")
    return DecodedToken(
        subject=str(sub),
        typ=str(payload["typ"]),
        jti=payload.get("jti"),
        exp=datetime.fromtimestamp(int(payload["exp"]), tz=timezone.utc),
        iat=datetime.fromtimestamp(int(payload["iat"]), tz=timezone.utc),
        ver=int(payload.get("ver", 0)),
    )
