from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from aegisai.config import get_settings
from aegisai.core.pipeline import (
    InputParseError,
    ParserTimeoutError,
    ParserUnavailableError,
    run_pipeline,
)
from aegisai.db.models import User
from aegisai.db.session import get_db
from aegisai.schemas import FirewallRequest, FirewallResponse
from aegisai.security.deps import get_current_user
from aegisai.security.rate_limit import limiter, user_rate_limit_key

router = APIRouter(prefix="/firewall", tags=["firewall"])

_INSPECT_LIMIT = f"{get_settings().rate_limit_inspect_per_min}/minute"


@router.post("/inspect", response_model=FirewallResponse)
@limiter.limit(_INSPECT_LIMIT, key_func=user_rate_limit_key)
async def inspect(
    request: Request,
    body: FirewallRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FirewallResponse:
    """Run one input through the firewall. A null ``session_id`` starts a new
    session; the generated id comes back in the response."""
    try:
        return await run_pipeline(body, user, db)
    except InputParseError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Could not parse the input as source_type '{body.source_type.value}'",
        ) from None
    except ParserUnavailableError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            f"The '{body.source_type.value}' parser is unavailable on this server",
        ) from None
    except ParserTimeoutError:
        raise HTTPException(
            status.HTTP_408_REQUEST_TIMEOUT,
            "Image OCR exceeded its safety time limit. Try a smaller or clearer image.",
        ) from None
