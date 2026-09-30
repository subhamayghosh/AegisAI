from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_env: str = "development"
    app_version: str = "0.1.0"
    log_level: str = "INFO"
    cors_allowed_origins: str = "http://localhost:3000"

    # Database
    database_url: str = "sqlite+aiosqlite:///./aegisai.db"

    # Auth
    jwt_secret: str = "change-me-to-a-32-byte-random-string"
    jwt_alg: str = "HS256"
    access_token_ttl_min: int = 15
    refresh_token_ttl_days: int = 7

    # Anthropic
    anthropic_api_key: str = ""
    claude_working_model: str = "claude-sonnet-5"
    claude_judge_model: str = "claude-opus-4-7"
    claude_timeout_s: int = 12
    claude_max_retries: int = 0

    # Image OCR guardrails. Tesseract is an external process, so bound both
    # the image dimensions and the amount of time it may consume per request.
    ocr_timeout_s: float = 10.0
    ocr_max_dimension: int = 4096
    ocr_vision_fallback: bool = True
    ocr_vision_timeout_s: float = 25.0
    ocr_vision_max_dimension: int = 1568

    # Tier thresholds
    # Tier 2 is an offline local encoder + vector index.  Deployments can
    # point at a pre-baked local model directory to avoid relying on the
    # Hugging Face service after startup.
    tier2_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    tier2_model_path: str = ""
    tier2_threshold: float = 0.75
    tier2_load_timeout_s: float = 15.0
    tier2_startup_timeout_s: float = 180.0
    session_jailbreak_threshold: float = 0.70

    # Rate limits
    rate_limit_login_per_min: int = 5
    rate_limit_inspect_per_min: int = 60

    # Seeding
    seed_admin_password: str = "AdminChangeMe123!"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",")]


_REDACT_RE = re.compile(r"password|token|api_key|authorization", re.IGNORECASE)


def redact(data: dict) -> dict:
    """Return a shallow copy of *data* with sensitive keys replaced by '***'."""
    return {k: "***" if _REDACT_RE.search(k) else v for k, v in data.items()}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


# ---------------------------------------------------------------------------
# Model allowlists (§7.3 — single source of truth for the whole app).
# The frontend fetches these via /users/me/settings/available-models so
# model IDs are never hard-coded in React.
# ---------------------------------------------------------------------------

# (id, label, description) — order matters: first entry is the recommended default.
WORKING_MODEL_ALLOWLIST: list[tuple[str, str, str]] = [
    ("claude-sonnet-5",           "Claude Sonnet 5",  "Balanced — recommended default"),
    ("claude-haiku-4-5-20251001", "Claude Haiku 4.5", "Fastest, cheapest"),
    ("claude-opus-4-7",           "Claude Opus 4.7",  "Highest quality on the Opus 4 family"),
    ("claude-opus-5-5",           "Claude Opus 5.5",  "Highest quality overall"),
]

# Haiku is deliberately excluded from the judge allowlist.
JUDGE_MODEL_ALLOWLIST: list[tuple[str, str, str]] = [
    ("claude-opus-4-7", "Claude Opus 4.7", "Recommended default — strong security reasoning"),
    ("claude-opus-5-5", "Claude Opus 5.5", "Highest quality — costlier"),
    ("claude-sonnet-5", "Claude Sonnet 5", "Faster, cheaper — acceptable for high-volume use"),
]

DEFAULT_WORKING_MODEL = "claude-sonnet-5"
DEFAULT_JUDGE_MODEL = "claude-opus-4-7"


def working_model_ids() -> list[str]:
    return [row[0] for row in WORKING_MODEL_ALLOWLIST]


def judge_model_ids() -> list[str]:
    return [row[0] for row in JUDGE_MODEL_ALLOWLIST]


def resolve_model_ids(user_settings: Any | None = None) -> tuple[str, str]:
    """Return the effective (working, judge) model IDs.

    Resolution order per §7.3 — first non-null wins:
      1. user_settings.working_model_id / .judge_model_id
      2. WORKING_MODEL_ALLOWLIST[0] / JUDGE_MODEL_ALLOWLIST[0]  (in-code defaults)
      3. Settings.claude_working_model / .claude_judge_model    (.env safety net)
    """
    s = get_settings()

    working = getattr(user_settings, "working_model_id", None) if user_settings else None
    if not working:
        working = WORKING_MODEL_ALLOWLIST[0][0] if WORKING_MODEL_ALLOWLIST else s.claude_working_model
    if not working:
        working = s.claude_working_model

    judge = getattr(user_settings, "judge_model_id", None) if user_settings else None
    if not judge:
        judge = JUDGE_MODEL_ALLOWLIST[0][0] if JUDGE_MODEL_ALLOWLIST else s.claude_judge_model
    if not judge:
        judge = s.claude_judge_model

    return working, judge
