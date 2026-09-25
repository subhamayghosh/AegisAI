from __future__ import annotations

from typing import AsyncIterator

import pytest
import pytest_asyncio
from httpx2 import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from promptshield.db.base import Base
from promptshield.db.session import get_db
from promptshield.main import app
from promptshield.security.rate_limit import limiter


@pytest_asyncio.fixture
async def db_engine():
    """Fresh in-memory SQLite engine per test.

    StaticPool keeps a single connection alive so the ':memory:' database
    is shared across every session in the test — required because aiosqlite
    memory DBs are per-connection by default.
    """
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db(db_engine) -> AsyncIterator[AsyncSession]:
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session


def _reset_limiter_storage() -> None:
    """slowapi keeps a MemoryStorage keyed by IP; wipe it between tests."""
    try:
        storage = limiter._storage
    except AttributeError:
        return
    for attr in ("reset", "clear"):
        fn = getattr(storage, attr, None)
        if callable(fn):
            try:
                fn()
                return
            except Exception:
                pass
    inner = getattr(storage, "storage", None)
    if isinstance(inner, dict):
        inner.clear()


@pytest_asyncio.fixture
async def client(db_engine) -> AsyncIterator[AsyncClient]:
    """Async HTTP client bound to the test DB with rate limiting disabled."""
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_db

    previous_enabled = limiter.enabled
    limiter.enabled = False
    _reset_limiter_storage()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    limiter.enabled = previous_enabled
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def rl_client(db_engine) -> AsyncIterator[AsyncClient]:
    """Client with rate limiting *enabled* — for the rate-limit test only."""
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_db

    previous_enabled = limiter.enabled
    limiter.enabled = True
    _reset_limiter_storage()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    limiter.enabled = previous_enabled
    _reset_limiter_storage()
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helpers reused across test modules
# ---------------------------------------------------------------------------


async def register_user(
    client: AsyncClient,
    email: str = "alice@example.com",
    password: str = "SuperSecret123!",
    display_name: str = "Alice",
) -> dict:
    resp = await client.post(
        "/auth/register",
        json={"email": email, "password": password, "display_name": display_name},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def login_user(
    client: AsyncClient,
    email: str = "alice@example.com",
    password: str = "SuperSecret123!",
) -> dict:
    resp = await client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def auth_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def make_user():
    """Factory returning (email, password, tokens) for a freshly registered user."""

    async def _make(client: AsyncClient, email: str = "alice@example.com") -> dict:
        return await register_user(client, email=email)

    return _make
