from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from promptshield.db.base import Base
from promptshield.db.models import User


@pytest.fixture
async def db() -> AsyncSession:
    """In-memory SQLite session with schema created fresh for each test."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session

    await engine.dispose()


async def test_user_email_is_lowercased_on_insert(db: AsyncSession) -> None:
    user = User(
        email="TEST@EXAMPLE.COM",
        password_hash="$2b$12$placeholder_hash",
        display_name="Test User",
        role="user",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    assert user.email == "test@example.com"


async def test_user_email_is_lowercased_on_mixed_case(db: AsyncSession) -> None:
    user = User(
        email="Alice.Foo@Bar.ORG",
        password_hash="$2b$12$placeholder_hash",
        display_name="Alice",
        role="user",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    assert user.email == "alice.foo@bar.org"


async def test_user_password_hash_persisted(db: AsyncSession) -> None:
    expected_hash = "$2b$12$examplehashvalue"
    user = User(
        email="bob@example.com",
        password_hash=expected_hash,
        display_name="Bob",
        role="user",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    assert user.password_hash is not None
    assert user.password_hash == expected_hash


async def test_user_defaults(db: AsyncSession) -> None:
    user = User(
        email="carol@example.com",
        password_hash="$2b$12$hash",
        display_name="Carol",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    assert user.is_active is True
    assert user.last_login_at is None
    assert user.id is not None
    assert user.created_at is not None


async def test_user_email_uniqueness(db: AsyncSession) -> None:
    from sqlalchemy.exc import IntegrityError

    db.add(User(email="dup@example.com", password_hash="h1", display_name="D1"))
    await db.commit()

    db.add(User(email="dup@example.com", password_hash="h2", display_name="D2"))
    with pytest.raises(IntegrityError):
        await db.commit()
