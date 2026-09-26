from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from promptshield.core.observability import get_metrics, get_recent_events
from promptshield.db.models import AuditLog, User
from promptshield.db.session import get_db
from promptshield.schemas import AuditLogOut, Decision, EventOut, MetricsOut, Page
from promptshield.security.deps import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/metrics", response_model=MetricsOut)
async def get_admin_metrics(_admin: User = Depends(require_admin)) -> MetricsOut:
    return MetricsOut(**get_metrics())


@router.get("/events", response_model=list[EventOut])
async def get_admin_events(
    n: int = Query(default=50, ge=1, le=100),
    _admin: User = Depends(require_admin),
) -> list[EventOut]:
    return [
        EventOut(
            timestamp=event.timestamp,
            input_hash=event.input_hash,
            decision=event.decision,
            attack_type=event.attack_type,
            source_type=event.source_type,
            latency_ms=event.latency_ms,
            user_id=event.user_id,
        )
        for event in get_recent_events(n)
    ]


@router.get("/audit", response_model=Page[AuditLogOut])
async def get_admin_audit(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    decision: Decision | None = None,
    event_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Page[AuditLogOut]:
    stmt = select(AuditLog)
    if decision is not None:
        stmt = stmt.where(AuditLog.decision == decision.value)
    if event_type is not None:
        stmt = stmt.where(AuditLog.event_type == event_type)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()

    rows = (
        (
            await db.execute(
                stmt.order_by(AuditLog.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )

    return Page[AuditLogOut](
        items=[AuditLogOut.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )
