from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from promptshield.db.models import Inspection, User
from promptshield.db.session import get_db
from promptshield.schemas import Page, SessionDetailOut, SessionSummaryOut, SessionTurnOut
from promptshield.security.deps import get_current_user

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=Page[SessionSummaryOut])
async def list_sessions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[SessionSummaryOut]:
    last_activity = func.max(Inspection.created_at).label("last_activity_at")
    stmt = (
        select(
            Inspection.session_id,
            func.count().label("turn_count"),
            func.max(Inspection.session_suspicion_score).label("max_suspicion_score"),
            func.min(Inspection.created_at).label("started_at"),
            last_activity,
        )
        .where(Inspection.user_id == user.id)
        .group_by(Inspection.session_id)
    )

    total = (
        await db.execute(
            select(func.count(func.distinct(Inspection.session_id))).where(
                Inspection.user_id == user.id
            )
        )
    ).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(last_activity.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).all()

    return Page[SessionSummaryOut](
        items=[SessionSummaryOut(**row._mapping) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{session_id}", response_model=SessionDetailOut)
async def get_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionDetailOut:
    rows = (
        (
            await db.execute(
                select(Inspection)
                .where(Inspection.user_id == user.id, Inspection.session_id == session_id)
                .order_by(Inspection.created_at, Inspection.turn_id)
            )
        )
        .scalars()
        .all()
    )
    # Scoped to the current user, so another user's session reads as missing.
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")

    return SessionDetailOut(
        session_id=session_id,
        turns=[
            SessionTurnOut(
                inspection_id=row.id,
                turn_id=row.turn_id,
                source_type=row.source_type,
                final_decision=row.decision,
                attack_type=row.attack_type,
                session_suspicion_score=row.session_suspicion_score,
                created_at=row.created_at,
            )
            for row in rows
        ],
    )
