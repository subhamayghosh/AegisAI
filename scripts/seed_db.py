"""Seed the database with one admin user and one demo user.

Run from the repo root:
    cd backend && python ../scripts/seed_db.py

Reads DATABASE_URL and SEED_ADMIN_PASSWORD from the environment / .env file.
"""
from __future__ import annotations

import asyncio
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

from promptshield.config import get_settings
from promptshield.db.base import Base
from promptshield.db.models import User, UserSettings


def _hash(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt(rounds=12)).decode()


async def _upsert_user(
    session: AsyncSession,
    email: str,
    password: str,
    display_name: str,
    role: str,
) -> User:
    result = await session.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()

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
    else:
        print(f"  Already exists, skipping: {email}")

    return user


async def main() -> None:
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
            email="admin@promptshield.local",
            password=admin_password,
            display_name="Admin",
            role="admin",
        )
        await _upsert_user(
            session,
            email="demo@promptshield.local",
            password="DemoPass123!",
            display_name="Demo User",
            role="user",
        )
        await session.commit()

    await engine.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
