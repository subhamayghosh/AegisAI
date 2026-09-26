from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from promptshield.db.models import Inspection, User
from promptshield.db.session import get_db
from promptshield.schemas import (
    AttackType,
    Decision,
    InspectionDetailOut,
    InspectionOut,
    Page,
    SourceType,
)
from promptshield.security.deps import get_current_user

router = APIRouter(prefix="/history", tags=["history"])


def _summary_fields(row: Inspection) -> dict:
    return {
        "id": row.id,
        "input_id": row.input_id,
        "session_id": row.session_id,
        "source_type": row.source_type,
        "final_decision": row.decision,
        "attack_type": row.attack_type,
        "input_hash": row.input_hash,
        "latency_ms_total": row.latency_ms,
        "created_at": row.created_at,
    }


@router.get("", response_model=Page[InspectionOut])
async def list_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    decision: Decision | None = None,
    attack_type: AttackType | None = None,
    source_type: SourceType | None = None,
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[InspectionOut]:
    stmt = select(Inspection).where(Inspection.user_id == user.id)
    if decision is not None:
        stmt = stmt.where(Inspection.decision == decision.value)
    if attack_type is not None:
        stmt = stmt.where(Inspection.attack_type == attack_type.value)
    if source_type is not None:
        stmt = stmt.where(Inspection.source_type == source_type.value)
    if from_ is not None:
        stmt = stmt.where(Inspection.created_at >= from_)
    if to is not None:
        stmt = stmt.where(Inspection.created_at <= to)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        (
            await db.execute(
                stmt.order_by(Inspection.created_at.desc(), Inspection.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )

    return Page[InspectionOut](
        items=[InspectionOut(**_summary_fields(row)) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{inspection_id}", response_model=InspectionDetailOut)
async def get_history_item(
    inspection_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InspectionDetailOut:
    row = (
        await db.execute(
            select(Inspection).where(Inspection.id == inspection_id, Inspection.user_id == user.id)
        )
    ).scalar_one_or_none()
    # Same 404 for "missing" and "someone else's" so ids can't be probed.
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inspection not found")

    return InspectionDetailOut(
        **_summary_fields(row),
        input_text=row.input_text,
        sanitized_text=row.sanitized_text,
        tier_signals=row.tier_signals or [],
        session_suspicion_score=row.session_suspicion_score,
        reason=row.reason,
        working_model_id=row.working_model_id,
        judge_model_id=row.judge_model_id,
    )
