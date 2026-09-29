from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from promptshield.db.models import AuditLog, RefreshToken, User
from promptshield.db.session import get_db
from promptshield.schemas import PasswordChangeIn, UserOut, UserPatchIn
from promptshield.security.deps import get_current_user
from promptshield.security.passwords import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
async def patch_me(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    # Parse the raw JSON body first so we can reject `email` explicitly
    # with a 400 (rather than relying on Pydantic's 422 for extra fields).
    raw = await request.json()
    if not isinstance(raw, dict):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Body must be an object")
    if "email" in raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email is immutable")

    body = UserPatchIn.model_validate(raw)

    if body.display_name is not None:
        user.display_name = body.display_name

    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    request: Request,
    body: PasswordChangeIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")

    user.password_hash = hash_password(body.new_password)
    # Invalidate every access token already issued, not just refresh
    # tokens — get_current_user rejects any token whose `ver` claim no
    # longer matches.
    user.token_version += 1

    # Revoke every outstanding refresh token — user must log in again on
    # other devices.
    now = datetime.now(timezone.utc)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )

    db.add(
        AuditLog(
            user_id=user.id,
            event_type="password_change",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
