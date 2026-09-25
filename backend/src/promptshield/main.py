from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from promptshield.api import admin, auth, firewall, history, sessions, settings, users
from promptshield.config import get_settings
from promptshield.logging_ import configure_logging
from promptshield.security.rate_limit import limiter

_settings = get_settings()
configure_logging(_settings.log_level)

app = FastAPI(
    title="PromptShield",
    version=_settings.app_version,
    description="Agentic prompt-injection firewall",
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
app.include_router(history.router)
app.include_router(sessions.router)
app.include_router(admin.router)


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
