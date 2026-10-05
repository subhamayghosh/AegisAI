from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from aegisai.api import admin, auth, firewall, history, metrics, mock_agent, sessions, settings, users
from aegisai.config import get_settings
from aegisai.core import pipeline
from aegisai.logging_ import configure_logging
from aegisai.security.rate_limit import limiter

_settings = get_settings()
configure_logging(_settings.log_level)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Start Tier 2 in the background so auth and the rest of the API are
    # available immediately. Inspection requests have their own bounded wait
    # and receive a tier2_unavailable signal if the model is not ready yet.
    pipeline.warm_up()
    yield


app = FastAPI(
    title="AegisAI",
    version=_settings.app_version,
    description="Protect every input before it reaches your AI agent.",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(settings.router)
app.include_router(firewall.router)
app.include_router(mock_agent.router)
app.include_router(history.router)
app.include_router(sessions.router)
app.include_router(admin.router)
app.include_router(metrics.router)


@app.get("/health", tags=["meta"])
async def health(request: Request) -> JSONResponse:
    s = get_settings()
    return JSONResponse(
        {
            "status": "ok",
            "version": s.app_version,
            "working_model": s.claude_working_model,
            "judge_model": s.claude_judge_model,
        }
    )
