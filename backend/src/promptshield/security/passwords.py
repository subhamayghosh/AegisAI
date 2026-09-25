from __future__ import annotations

import bcrypt

_ROUNDS = 12
_MAX_BYTES = 72  # bcrypt hard limit — enforce explicitly for a clear error.


def hash_password(password: str) -> str:
    """Return a bcrypt hash of *password* (cost 12)."""
    encoded = password.encode("utf-8")
    if len(encoded) > _MAX_BYTES:
        raise ValueError(f"Password must be at most {_MAX_BYTES} bytes when UTF-8 encoded.")
    return bcrypt.hashpw(encoded, bcrypt.gensalt(rounds=_ROUNDS)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Constant-time password verification. Returns False on any error."""
    try:
        encoded = password.encode("utf-8")
        if len(encoded) > _MAX_BYTES:
            return False
        return bcrypt.checkpw(encoded, hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False
