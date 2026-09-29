from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from promptshield.db.models import Inspection, User
from promptshield.core import session_tracker
from promptshield.schemas import TierName, TierSignal
from tests.conftest import auth_headers, register_user

BASE_TIME = datetime(2026, 9, 20, 12, 0, tzinfo=UTC)


async def _user_id(db, email: str) -> uuid.UUID:
    return (await db.execute(select(User.id).where(User.email == email))).scalar_one()


def _inspection(user_id: uuid.UUID, minutes: int, **overrides: object) -> Inspection:
    fields: dict = {
        "user_id": user_id,
        "session_id": uuid.uuid4(),
        "input_id": uuid.uuid4(),
        "turn_id": 1,
        "source_type": "user_message",
        "input_hash": f"hash-{minutes}",
        "decision": "ALLOW",
        "attack_type": None,
        "tier_signals": [
            {"tier": "tier1_heuristic", "flagged": False, "confidence": 0.0, "latency_ms": 1}
        ],
        "session_suspicion_score": 0.0,
        "latency_ms": 10,
        "reason": "no tier flagged the input",
        "working_model_id": "claude-sonnet-5",
        "judge_model_id": "claude-opus-4-7",
        "created_at": BASE_TIME + timedelta(minutes=minutes),
    }
    fields.update(overrides)
    return Inspection(**fields)


@pytest.fixture
async def alice(client, db) -> dict:
    tokens = await register_user(client)
    return {
        "headers": auth_headers(tokens["access_token"]),
        "id": await _user_id(db, "alice@example.com"),
    }


@pytest.fixture
async def bob(client, db) -> dict:
    tokens = await register_user(client, email="bob@example.com")
    return {
        "headers": auth_headers(tokens["access_token"]),
        "id": await _user_id(db, "bob@example.com"),
    }


# ---------------------------------------------------------------------------
# /history
# ---------------------------------------------------------------------------


async def test_history_lists_only_own_rows_newest_first_with_pagination(
    client, db, alice, bob
) -> None:
    db.add_all([_inspection(alice["id"], minutes=m) for m in range(5)])
    db.add(_inspection(bob["id"], minutes=99))
    await db.commit()

    first = (await client.get("/history?page=1&page_size=2", headers=alice["headers"])).json()
    third = (await client.get("/history?page=3&page_size=2", headers=alice["headers"])).json()

    assert first["total"] == 5
    assert [item["input_hash"] for item in first["items"]] == ["hash-4", "hash-3"]
    assert [item["input_hash"] for item in third["items"]] == ["hash-0"]


async def test_history_filters_by_decision_attack_type_and_source_type(client, db, alice) -> None:
    db.add_all(
        [
            _inspection(alice["id"], 0),
            _inspection(alice["id"], 1, decision="BLOCK", attack_type="instruction_override"),
            _inspection(
                alice["id"],
                2,
                decision="NEUTRALIZE",
                attack_type="indirect_prompt_injection",
                source_type="pdf",
            ),
        ]
    )
    await db.commit()
    headers = alice["headers"]

    blocked = (await client.get("/history?decision=BLOCK", headers=headers)).json()
    indirect = (
        await client.get("/history?attack_type=indirect_prompt_injection", headers=headers)
    ).json()
    pdfs = (await client.get("/history?source_type=pdf", headers=headers)).json()

    assert [i["final_decision"] for i in blocked["items"]] == ["BLOCK"]
    assert [i["input_hash"] for i in indirect["items"]] == ["hash-2"]
    assert [i["source_type"] for i in pdfs["items"]] == ["pdf"]


async def test_history_time_range_honours_timezone_offsets(client, db, alice) -> None:
    db.add_all([_inspection(alice["id"], m) for m in (0, 30, 60)])
    await db.commit()

    # 17:45+05:30 is 12:15 UTC, so only the 12:30 row falls in [12:15, 12:45] UTC.
    resp = await client.get(
        "/history",
        params={"from": "2026-09-20T17:45:00+05:30", "to": "2026-09-20T12:45:00+00:00"},
        headers=alice["headers"],
    )

    assert [item["input_hash"] for item in resp.json()["items"]] == ["hash-30"]


async def test_history_detail_returns_signals_and_hides_other_users_rows(
    client, db, alice, bob
) -> None:
    own = _inspection(alice["id"], 0, decision="BLOCK", reason="tier1 high-confidence match")
    theirs = _inspection(bob["id"], 1)
    db.add_all([own, theirs])
    await db.commit()

    detail = await client.get(f"/history/{own.id}", headers=alice["headers"])
    foreign = await client.get(f"/history/{theirs.id}", headers=alice["headers"])
    missing = await client.get(f"/history/{uuid.uuid4()}", headers=alice["headers"])

    assert detail.status_code == 200
    body = detail.json()
    assert body["final_decision"] == "BLOCK"
    assert body["reason"] == "tier1 high-confidence match"
    assert body["tier_signals"][0]["tier"] == "tier1_heuristic"
    assert body["input_text"] is None
    # Someone else's row and a nonexistent row are indistinguishable.
    assert foreign.status_code == missing.status_code == 404
    assert foreign.json() == missing.json()


async def test_history_requires_authentication(client) -> None:
    assert (await client.get("/history")).status_code == 401


async def test_history_delete_is_user_scoped_and_clear_resets_only_the_callers_scores(
    client, db, alice, bob
) -> None:
    own_session = uuid.uuid4()
    own = _inspection(alice["id"], 0, session_id=own_session)
    other = _inspection(bob["id"], 1)
    remaining = _inspection(alice["id"], 2)
    db.add_all([own, other, remaining])
    await db.commit()

    signal = TierSignal(tier=TierName.tier1_heuristic, flagged=True, confidence=0.8)
    session_tracker.update(f"{alice['id']}:{own_session}", [signal])
    session_tracker.update(f"{bob['id']}:{other.session_id}", [signal])

    deleted = await client.delete(f"/history/{own.id}", headers=alice["headers"])
    foreign = await client.delete(f"/history/{other.id}", headers=alice["headers"])
    cleared = await client.delete("/history", headers=alice["headers"])

    assert deleted.status_code == 200
    assert deleted.json() == {"deleted_count": 1}
    assert foreign.status_code == 404
    assert cleared.status_code == 200
    assert cleared.json() == {"deleted_count": 1}
    assert (await client.get("/history", headers=alice["headers"])).json()["total"] == 0
    assert (await client.get("/history", headers=bob["headers"])).json()["total"] == 1
    assert session_tracker.get_score(f"{alice['id']}:{own_session}") == 0.0
    assert session_tracker.get_score(f"{bob['id']}:{other.session_id}") > 0.0


# ---------------------------------------------------------------------------
# /sessions
# ---------------------------------------------------------------------------


async def test_sessions_aggregate_turn_count_and_max_score(client, db, alice, bob) -> None:
    long_session, short_session = uuid.uuid4(), uuid.uuid4()
    db.add_all(
        [
            _inspection(alice["id"], 0, session_id=long_session, session_suspicion_score=0.2),
            _inspection(alice["id"], 1, session_id=long_session, session_suspicion_score=0.7),
            _inspection(alice["id"], 2, session_id=long_session, session_suspicion_score=0.5),
            _inspection(alice["id"], 10, session_id=short_session, session_suspicion_score=0.1),
            _inspection(bob["id"], 20, session_id=long_session, session_suspicion_score=0.99),
        ]
    )
    await db.commit()

    body = (await client.get("/sessions", headers=alice["headers"])).json()

    assert body["total"] == 2
    # Most recently active first.
    assert [item["session_id"] for item in body["items"]] == [
        str(short_session),
        str(long_session),
    ]
    long_summary = body["items"][1]
    assert long_summary["turn_count"] == 3
    # Bob's 0.99 on the same session id must not leak into Alice's aggregate.
    assert long_summary["max_suspicion_score"] == pytest.approx(0.7)
    assert long_summary["started_at"].startswith("2026-09-20T12:00")
    assert long_summary["last_activity_at"].startswith("2026-09-20T12:02")


async def test_session_detail_orders_turns_and_hides_other_users_sessions(
    client, db, alice, bob
) -> None:
    session_id = uuid.uuid4()
    bobs_session = uuid.uuid4()
    db.add_all(
        [
            _inspection(alice["id"], 2, session_id=session_id, turn_id=3, decision="BLOCK"),
            _inspection(alice["id"], 0, session_id=session_id, turn_id=1),
            _inspection(alice["id"], 1, session_id=session_id, turn_id=2, decision="NEUTRALIZE"),
            _inspection(bob["id"], 5, session_id=bobs_session),
        ]
    )
    await db.commit()

    detail = await client.get(f"/sessions/{session_id}", headers=alice["headers"])
    foreign = await client.get(f"/sessions/{bobs_session}", headers=alice["headers"])

    assert detail.status_code == 200
    turns = detail.json()["turns"]
    assert [t["turn_id"] for t in turns] == [1, 2, 3]
    assert [t["final_decision"] for t in turns] == ["ALLOW", "NEUTRALIZE", "BLOCK"]
    assert foreign.status_code == 404
