from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aegisai.config import (
    DEFAULT_JUDGE_MODEL,
    DEFAULT_WORKING_MODEL,
    JUDGE_MODEL_ALLOWLIST,
    WORKING_MODEL_ALLOWLIST,
    judge_model_ids,
    resolve_model_ids,
    working_model_ids,
)
from aegisai.db.models import AuditLog, User, UserSettings
from aegisai.db.session import get_db
from aegisai.schemas import (
    AvailableModelsDefaults,
    AvailableModelsResponse,
    EffectiveModels,
    ModelOption,
    Theme,
    UserSettingsGetOut,
    UserSettingsIn,
)
from aegisai.security.deps import get_current_user

router = APIRouter(prefix="/users/me/settings", tags=["settings"])


_VALID_THEMES = {t.value for t in Theme}


async def _get_or_create_settings(db: AsyncSession, user: User) -> UserSettings:
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    row = result.scalar_one_or_none()
    if row is None:
        row = UserSettings(user_id=user.id)
        db.add(row)
        await db.flush()
    return row


def _to_out(row: UserSettings) -> UserSettingsGetOut:
    working, judge = resolve_model_ids(row)
    return UserSettingsGetOut(
        working_model_id=row.working_model_id,
        judge_model_id=row.judge_model_id,
        store_raw_text_in_history=row.store_raw_text_in_history,
        tier2_threshold=row.tier2_threshold,
        session_jailbreak_threshold=row.session_jailbreak_threshold,
        theme=Theme(row.theme),
        effective=EffectiveModels(working=working, judge=judge),
    )


@router.get("", response_model=UserSettingsGetOut)
async def get_settings_endpoint(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsGetOut:
    row = await _get_or_create_settings(db, user)
    await db.commit()
    return _to_out(row)


@router.put("", response_model=UserSettingsGetOut)
async def put_settings(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsGetOut:
    raw = await request.json()
    if not isinstance(raw, dict):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Body must be an object")

    # Detect explicit-null vs absent-key semantics (we need to distinguish
    # "clear this preference" from "don't touch it").
    provided = set(raw.keys())
    try:
        body = UserSettingsIn.model_validate(raw)
    except ValidationError as exc:
        errors = exc.errors()
        first = errors[0] if errors else {}
        field = ".".join(str(p) for p in first.get("loc", ())) or "body"
        msg = first.get("msg", "invalid value")
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"{field}: {msg}",
        ) from exc

    row = await _get_or_create_settings(db, user)

    if "working_model_id" in provided:
        value = body.working_model_id
        if value is not None and value not in working_model_ids():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"working_model_id must be one of: {', '.join(working_model_ids())}",
            )
        row.working_model_id = value

    if "judge_model_id" in provided:
        value = body.judge_model_id
        if value is not None and value not in judge_model_ids():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"judge_model_id must be one of: {', '.join(judge_model_ids())}",
            )
        row.judge_model_id = value

    if "store_raw_text_in_history" in provided and body.store_raw_text_in_history is not None:
        row.store_raw_text_in_history = body.store_raw_text_in_history

    if "tier2_threshold" in provided and body.tier2_threshold is not None:
        if not 0.5 <= body.tier2_threshold <= 0.95:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "tier2_threshold must be between 0.5 and 0.95",
            )
        row.tier2_threshold = body.tier2_threshold

    if "session_jailbreak_threshold" in provided and body.session_jailbreak_threshold is not None:
        if not 0.5 <= body.session_jailbreak_threshold <= 0.95:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "session_jailbreak_threshold must be between 0.5 and 0.95",
            )
        row.session_jailbreak_threshold = body.session_jailbreak_threshold

    if "theme" in provided and body.theme is not None:
        theme_val = body.theme.value if hasattr(body.theme, "value") else str(body.theme)
        if theme_val not in _VALID_THEMES:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"theme must be one of: {', '.join(sorted(_VALID_THEMES))}",
            )
        row.theme = theme_val

    row.updated_at = datetime.now(timezone.utc)

    db.add(
        AuditLog(
            user_id=user.id,
            event_type="settings_change",
            metadata_={"fields": sorted(provided)},
        )
    )
    await db.commit()
    await db.refresh(row)
    return _to_out(row)


@router.get("/available-models", response_model=AvailableModelsResponse)
async def available_models(
    user: User = Depends(get_current_user),
) -> AvailableModelsResponse:
    return AvailableModelsResponse(
        working=[ModelOption(id=i, label=l, description=d) for i, l, d in WORKING_MODEL_ALLOWLIST],
        judge=[ModelOption(id=i, label=l, description=d) for i, l, d in JUDGE_MODEL_ALLOWLIST],
        defaults=AvailableModelsDefaults(
            working=DEFAULT_WORKING_MODEL,
            judge=DEFAULT_JUDGE_MODEL,
        ),
    )
