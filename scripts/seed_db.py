"""Seed the database with one admin user and one demo user.

Run from the repo root:
    cd backend && python ../scripts/seed_db.py
    # Recover the local seeded admin using SEED_ADMIN_PASSWORD from .env:
    python ../scripts/seed_db.py --reset-admin-password

Reads DATABASE_URL and SEED_ADMIN_PASSWORD from the environment / .env file.
"""
from __future__ import annotations

import asyncio
import argparse
import os
import sys

# Ensure the src/ package is importable when run from repo root or backend/.
_here = os.path.dirname(__file__)
_src = os.path.join(_here, "..", "backend", "src")
if _src not in sys.path:
    sys.path.insert(0, _src)

import bcrypt as _bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from aegisai.config import get_settings
from aegisai.db.base import Base
from aegisai.db.models import User, UserSettings


# ``email-validator`` (used by Pydantic's EmailStr) rejects reserved .local
# addresses before an authentication attempt reaches the password check. Keep
# this migration so existing local demo databases remain usable after upgrading.
LEGACY_SEEDED_EMAILS = {
    "admin@aegisai.dev": "admin@aegisai.local",
    "demo@aegisai.dev": "demo@aegisai.local",
}


def _hash(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt(rounds=12)).decode()


async def _upsert_user(
    session: AsyncSession,
    email: str,
    password: str,
    display_name: str,
    role: str,
    reset_existing_password: bool = False,
) -> User:
    result = await session.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()
    migrated_legacy_user = False

    if user is None and (legacy_email := LEGACY_SEEDED_EMAILS.get(email)):
        legacy_result = await session.execute(select(User).where(User.email == legacy_email))
        user = legacy_result.scalar_one_or_none()
        if user is not None:
            user.email = email
            migrated_legacy_user = True
            print(f"  Migrated {role} sign-in: {legacy_email} -> {email}")

    if user is None:
        user = User(
            email=email,
            password_hash=_hash(password),
            display_name=display_name,
            role=role,
        )
        session.add(user)
        await session.flush()

        settings = UserSettings(user_id=user.id)
        session.add(settings)

        print(f"  Created {role}: {email}")
    elif reset_existing_password:
        # This is deliberately opt-in and is used only for the local seeded
        # admin. Incrementing the version immediately invalidates any access
        # tokens created with the old password.
        user.password_hash = _hash(password)
        user.token_version += 1
        print(f"  Reset password for {role}: {email}")
    elif not migrated_legacy_user:
        print(f"  Already exists, skipping: {email}")

    return user


async def main(reset_admin_password: bool = False) -> None:
    s = get_settings()
    admin_password = s.seed_admin_password

    engine = create_async_engine(s.database_url, echo=False)

    # Ensure schema exists (idempotent — safe to call if alembic already ran)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("Seeding database...")
    async with async_session() as session:
        await _upsert_user(
            session,
            email="admin@aegisai.dev",
            password=admin_password,
            display_name="Admin",
            role="admin",
            reset_existing_password=reset_admin_password,
        )
        await _upsert_user(
            session,
            email="demo@aegisai.dev",
            password="DemoPass123!",
            display_name="Demo User",
            role="user",
        )
        await session.commit()

    await engine.dispose()
    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed AegisAI's local demo accounts.")
    parser.add_argument(
        "--reset-admin-password",
        action="store_true",
        help="reset the existing seeded admin to SEED_ADMIN_PASSWORD from .env",
    )
    args = parser.parse_args()
    asyncio.run(main(reset_admin_password=args.reset_admin_password))
