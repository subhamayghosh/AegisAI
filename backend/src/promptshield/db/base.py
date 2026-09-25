from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import MetaData, Text, types
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


# ---------------------------------------------------------------------------
# Cross-database TypeDecorators
# ---------------------------------------------------------------------------


class GUID(types.TypeDecorator):
    """UUID on PostgreSQL, CHAR(36) on SQLite."""

    impl = types.CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID

            return dialect.type_descriptor(UUID(as_uuid=True))
        return dialect.type_descriptor(types.CHAR(36))

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        return str(value) if isinstance(value, uuid.UUID) else str(uuid.UUID(str(value)))

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


class CIText(types.TypeDecorator):
    """CITEXT on PostgreSQL (case-insensitive), lowercased Text elsewhere.

    Lowercasing in process_bind_param ensures SQLite behaves identically
    to PostgreSQL's CITEXT for equality lookups on email fields.
    """

    impl = types.Text
    cache_ok = True

    class _PGCIText(types.UserDefinedType):
        cache_ok = True

        def get_col_spec(self, **kw: Any) -> str:
            return "CITEXT"

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(self._PGCIText())
        return dialect.type_descriptor(types.Text())

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        return value.lower() if value is not None else None

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        return value


class JSONBText(types.TypeDecorator):
    """JSONB on PostgreSQL, JSON-serialised Text on SQLite."""

    impl = types.Text
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import JSONB

            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(types.Text())

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        return json.dumps(value)

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            return json.loads(value)
        return value


class TZDateTime(types.TypeDecorator):
    """TIMESTAMPTZ on PostgreSQL, timezone-aware DateTime on SQLite."""

    impl = types.DateTime
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import TIMESTAMP

            return dialect.type_descriptor(TIMESTAMP(timezone=True))
        return dialect.type_descriptor(types.DateTime(timezone=True))

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is not None and isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is not None and isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class IPAddress(types.TypeDecorator):
    """INET on PostgreSQL, Text on SQLite."""

    impl = types.Text
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import INET

            return dialect.type_descriptor(INET())
        return dialect.type_descriptor(types.Text())

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        return str(value) if value is not None else None

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        return value
