from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from promptshield.db.models import AuditLog, RefreshToken, User, UserSettings
from promptshield.db.session import get_db
from promptshield.schemas import (
    AuthResponse,
    LoginIn,
    RefreshIn,
    RefreshResponse,
    RegisterIn,
    UserOut,
)
from promptshield.security.deps import get_current_user
from promptshield.security.jwt import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_jti,
    refresh_token_expiry,
)
from promptshield.security.passwords import hash_password, verify_password
from promptshield.security.rate_limit import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid credentials",
)


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


async def _issue_tokens(db: AsyncSession, user: User) -> tuple[str, str]:
    access = create_access_token(user.id, token_version=user.token_version)
    refresh, jti = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_jti(jti),
            expires_at=refresh_token_expiry(),
        )
    )
    return access, refresh


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("3/minute")
async def register(
    request: Request,
    body: RegisterIn,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    email_norm = body.email.lower()

    existing = await db.execute(select(User).where(User.email == email_norm))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    user = User(
        email=email_norm,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        role="user",
    )
    db.add(user)
    await db.flush()

    # Every user gets a settings row on registration; model IDs left null
    # so the resolver falls back to app defaults until they choose.
    db.add(UserSettings(user_id=user.id))

    access, refresh = await _issue_tokens(db, user)
    await db.commit()
    await db.refresh(user)

    return AuthResponse(
        user=UserOut.model_validate(user),
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/login", response_model=AuthResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: LoginIn,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    email_norm = body.email.lower()
    result = await db.execute(select(User).where(User.email == email_norm))
    user = result.scalar_one_or_none()

    ip = _client_ip(request)
    ua = _user_agent(request)

    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        db.add(
            AuditLog(
                user_id=user.id if user else None,
                event_type="login_fail",
                ip_address=ip,
                user_agent=ua,
                metadata_={"email": email_norm},
            )
        )
        await db.commit()
        raise _INVALID_CREDENTIALS

    user.last_login_at = datetime.now(timezone.utc)
    db.add(
        AuditLog(
            user_id=user.id,
            event_type="login_success",
            ip_address=ip,
            user_agent=ua,
        )
    )
    access, refresh = await _issue_tokens(db, user)
    await db.commit()
    await db.refresh(user)

    return AuthResponse(
        user=UserOut.model_validate(user),
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    request: Request,
    body: RefreshIn,
    db: AsyncSession = Depends(get_db),
) -> RefreshResponse:
    try:
        decoded = decode_refresh_token(body.refresh_token)
    except TokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token") from None

    assert decoded.jti is not None  # guaranteed by decode_refresh_token
    token_hash = hash_jti(decoded.jti)

    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    row = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if row is None or row.revoked_at is not None or row.expires_at <= now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    row.revoked_at = now

    # Load user to confirm they still exist and are active
    user_result = await db.execute(select(User).where(User.id == row.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        await db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    access, new_refresh = await _issue_tokens(db, user)
    await db.commit()

    return RefreshResponse(access_token=access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Revoke all outstanding refresh tokens for the current user."""
    now = datetime.now(timezone.utc)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
