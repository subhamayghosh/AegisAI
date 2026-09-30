"""Run all long manual fixtures through the real configured Anthropic path.

The runner uses an in-memory database, synthetic identity, hash-only history,
and prints only decisions/model availability/latency. It never prints the API
key, raw fixture content, OCR transcription, or model reasoning.
"""

from __future__ import annotations

import asyncio
import base64
import json
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend" / "src"))
load_dotenv(ROOT / ".env")

from aegisai.config import get_settings  # noqa: E402
from aegisai.core import pipeline  # noqa: E402
from aegisai.db.base import Base  # noqa: E402
from aegisai.db.models import User, UserSettings  # noqa: E402
from aegisai.schemas import FirewallRequest, SourceType, TierName, TierSignal  # noqa: E402

FIXTURES = ROOT / "manual_test_cases" / "complex_scenarios" / "fixtures"
BINARY_TYPES = {SourceType.pdf, SourceType.word_doc, SourceType.image}


async def _benign_tier2(_text: str, _source_type: SourceType) -> TierSignal:
    """Keep this live check focused on parsers + configured Anthropic models."""
    return TierSignal(
        tier=TierName.tier2_semantic,
        flagged=False,
        confidence=0.0,
        matched_rule="tier2_not_part_of_live_smoke",
        notes="Live smoke isolates the configured Anthropic path.",
    )


def _payload(path: Path, source_type: SourceType) -> str:
    if source_type in BINARY_TYPES:
        return base64.b64encode(path.read_bytes()).decode("ascii")
    return path.read_text(encoding="utf-8")


async def main() -> int:
    settings = get_settings()
    if not settings.anthropic_api_key:
        print("ERROR: ANTHROPIC_API_KEY is not configured in the untracked .env file.")
        return 2

    manifest = json.loads(FIXTURES.joinpath("manifest.json").read_text(encoding="utf-8"))
    selected_ids = {value.upper() for value in sys.argv[1:]}
    cases = [
        case for case in manifest["cases"] if not selected_ids or case["id"] in selected_ids
    ]
    if selected_ids - {case["id"] for case in cases}:
        print("ERROR: unknown case id. Valid ids are C01 through C11.")
        return 2
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    pipeline._tier2.detect = _benign_tier2

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    failures = 0
    try:
        async with session_factory() as db:
            user = User(
                email="complex-live-smoke@example.invalid",
                password_hash="synthetic-not-a-login-secret",
                display_name="Complex Fixture Smoke",
                role="user",
            )
            user.settings = UserSettings(store_raw_text_in_history=False)
            db.add(user)
            await db.commit()

            print("ID  SOURCE         DECISION     CLAUDE_JUDGE  OCR_FALLBACK  LATENCY_MS")
            for case in cases:
                source_type = SourceType(case["source_type"])
                request = FirewallRequest(
                    input_id=uuid.uuid4(),
                    turn_id=1,
                    text=_payload(FIXTURES / case["file"], source_type),
                    source_type=source_type,
                    metadata={"filename": case["file"]},
                )
                result = await pipeline.run_pipeline(request, user, db)
                judge = next(
                    (
                        signal
                        for signal in result.tier_signals
                        if signal.tier == TierName.tier3_llm_judge
                    ),
                    None,
                )
                judge_ok = bool(judge and (judge.matched_rule or "").startswith("llm_judge:"))
                ocr_fallback = source_type == SourceType.image and settings.ocr_vision_fallback
                passed = result.final_decision.value != "ALLOW" and judge_ok
                failures += int(not passed)
                print(
                    f"{case['id']:<3} {source_type.value:<14} {result.final_decision.value:<12} "
                    f"{str(judge_ok):<13} {str(ocr_fallback):<13} {result.latency_ms_total}"
                )
    finally:
        await engine.dispose()

    print(f"SUMMARY: {len(cases) - failures}/{len(cases)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
