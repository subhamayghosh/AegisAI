from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from promptshield.config import get_settings

# Engine and session factory are created once and reused for the process lifetime.
# Tests may patch get_settings() or create their own engine independently.


def _build_engine() -> AsyncEngine:
    s = get_settings()
    connect_args: dict = {}
    if "sqlite" in s.database_url:
        connect_args["check_same_thread"] = False
    return create_async_engine(
        s.database_url,
        echo=(s.app_env == "development"),
        connect_args=connect_args,
    )


engine: AsyncEngine = _build_engine()

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a database session per request."""
    async with AsyncSessionLocal() as session:
        yield session
