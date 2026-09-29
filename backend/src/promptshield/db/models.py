from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    event,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from promptshield.db.base import (
    Base,
    CIText,
    GUID,
    IPAddress,
    JSONBText,
    TZDateTime,
)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# users
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(CIText, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(10), nullable=False, server_default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=_now_utc)
    last_login_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    # Bumped on password change so every access token issued before the
    # change fails its `ver` check immediately, without relying on
    # clock-resolution timestamp comparisons.
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    settings: Mapped[UserSettings | None] = relationship(
        "UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    inspections: Mapped[list[Inspection]] = relationship(
        "Inspection", back_populates="user", cascade="all, delete-orphan"
    )
    audit_entries: Mapped[list[AuditLog]] = relationship(
        "AuditLog", back_populates="user"
    )


@event.listens_for(User, "before_insert")
@event.listens_for(User, "before_update")
def _lowercase_user_email(
    mapper: Any, connection: Any, target: User
) -> None:
    if target.email:
        target.email = target.email.lower()


# ---------------------------------------------------------------------------
# user_settings
# ---------------------------------------------------------------------------


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    working_model_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    judge_model_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    store_raw_text_in_history: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    tier2_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.75)
    session_jailbreak_threshold: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.70
    )
    theme: Mapped[str] = mapped_column(String(10), nullable=False, server_default="auto")
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=_now_utc)

    user: Mapped[User] = relationship("User", back_populates="settings")


# ---------------------------------------------------------------------------
# refresh_tokens
# ---------------------------------------------------------------------------


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=_now_utc)

    user: Mapped[User] = relationship("User", back_populates="refresh_tokens")


# ---------------------------------------------------------------------------
# inspections
# ---------------------------------------------------------------------------


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[uuid.UUID] = mapped_column(GUID, nullable=False)
    input_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    turn_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    input_hash: Mapped[str] = mapped_column(Text, nullable=False)
    input_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision: Mapped[str] = mapped_column(String(12), nullable=False)
    attack_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    tier_signals: Mapped[list[dict] | None] = mapped_column(JSONBText, nullable=True)
    sanitized_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    session_suspicion_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    working_model_id: Mapped[str] = mapped_column(Text, nullable=False)
    judge_model_id: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=_now_utc)

    user: Mapped[User] = relationship("User", back_populates="inspections")

    __table_args__ = (
        Index("ix_inspections_user_id_created_at", "user_id", "created_at"),
        Index("ix_inspections_session_id_turn_id", "session_id", "turn_id"),
        Index("ix_inspections_decision", "decision"),
        Index("ix_inspections_attack_type", "attack_type"),
    )


# ---------------------------------------------------------------------------
# audit_log
# ---------------------------------------------------------------------------


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_type: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    ip_address: Mapped[str | None] = mapped_column(IPAddress, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSONBText, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=_now_utc)

    user: Mapped[User | None] = relationship("User", back_populates="audit_entries")
