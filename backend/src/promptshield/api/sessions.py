from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/", include_in_schema=False)
async def _stub() -> JSONResponse:
    return JSONResponse(status_code=501, content={"detail": "Not implemented"})
