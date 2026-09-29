from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegisai.db.models import User
from aegisai.db.session import get_db
from aegisai.security.jwt import TokenError, decode_access_token

_bearer = HTTPBearer(auto_error=False)

_UNAUTH = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise _UNAUTH

    try:
        decoded = decode_access_token(credentials.credentials)
    except TokenError:
        raise _UNAUTH from None

    try:
        user_id = uuid.UUID(decoded.subject)
    except (ValueError, TypeError):
        raise _UNAUTH from None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise _UNAUTH
    if decoded.ver != user.token_version:
        # Password change bumped token_version — this access token predates
        # it and must not keep working for its remaining TTL.
        raise _UNAUTH
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user
