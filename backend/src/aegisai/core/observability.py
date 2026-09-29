from __future__ import annotations

import threading
import uuid
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from aegisai.db.models import AuditLog
from aegisai.schemas import AttackType, Decision, SourceType

_RING_BUFFER_SIZE = 100


@dataclass(frozen=True)
class Event:
    """One inspection outcome — never carries raw input text."""

    timestamp: datetime
    input_hash: str
    decision: Decision
    attack_type: AttackType | None
    source_type: SourceType
    latency_ms: int
    user_id: str | None


class _Metrics:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.total = 0
        self.allowed = 0
        self.blocked = 0
        self.neutralized = 0
        self.by_attack_type: dict[str, int] = {}
        self.by_source_type: dict[str, int] = {}
        self.events: deque[Event] = deque(maxlen=_RING_BUFFER_SIZE)

    def record(self, event: Event) -> None:
        with self._lock:
            self.total += 1
            if event.decision == Decision.ALLOW:
                self.allowed += 1
            elif event.decision == Decision.BLOCK:
                self.blocked += 1
            elif event.decision == Decision.NEUTRALIZE:
                self.neutralized += 1

            if event.attack_type is not None:
                key = event.attack_type.value
                self.by_attack_type[key] = self.by_attack_type.get(key, 0) + 1

            source_key = event.source_type.value
            self.by_source_type[source_key] = self.by_source_type.get(source_key, 0) + 1

            self.events.append(event)

    def snapshot_metrics(self) -> dict:
        with self._lock:
            return {
                "total": self.total,
                "allowed": self.allowed,
                "blocked": self.blocked,
                "neutralized": self.neutralized,
                "by_attack_type": dict(self.by_attack_type),
                "by_source_type": dict(self.by_source_type),
            }

    def snapshot_events(self, n: int) -> list[Event]:
        with self._lock:
            return list(self.events)[-n:]


_metrics = _Metrics()


def log_event(
    *,
    input_hash: str,
    decision: Decision,
    attack_type: AttackType | None,
    source_type: SourceType,
    latency_ms: int,
    user_id: str | None,
) -> Event:
    """Record an inspection outcome in the counters and ring buffer."""
    event = Event(
        timestamp=datetime.now(timezone.utc),
        input_hash=input_hash,
        decision=decision,
        attack_type=attack_type,
        source_type=source_type,
        latency_ms=latency_ms,
        user_id=user_id,
    )
    _metrics.record(event)
    return event


def get_metrics() -> dict:
    return _metrics.snapshot_metrics()


def get_recent_events(n: int = 50) -> list[Event]:
    return _metrics.snapshot_events(n)


def reset() -> None:
    """Test-only: the metrics store is a module-level singleton, so tests
    that assert on counts must reset it between runs."""
    global _metrics
    _metrics = _Metrics()


async def persist_audit_row(db: AsyncSession, event: Event) -> None:
    """Write a compact audit_log row for *event* — hash + decision + counts
    only, per the security rule that raw input text never reaches the audit
    log."""
    db.add(
        AuditLog(
            user_id=uuid.UUID(event.user_id) if event.user_id else None,
            event_type="firewall_inspect",
            input_hash=event.input_hash,
            decision=event.decision.value,
            metadata_={
                "attack_type": event.attack_type.value if event.attack_type else None,
                "source_type": event.source_type.value,
                "latency_ms": event.latency_ms,
            },
        )
    )
    await db.commit()
