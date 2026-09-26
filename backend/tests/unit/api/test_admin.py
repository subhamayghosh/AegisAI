from __future__ import annotations

from sqlalchemy import select, update

from promptshield.db.models import AuditLog, User
from tests.conftest import auth_headers, register_user


async def _promote_to_admin(db, email: str) -> None:
    await db.execute(update(User).where(User.email == email).values(role="admin"))
    await db.commit()


async def test_admin_routes_reject_non_admin(client):
    tokens = await register_user(client)
    headers = auth_headers(tokens["access_token"])

    assert (await client.get("/admin/metrics", headers=headers)).status_code == 403
    assert (await client.get("/admin/events", headers=headers)).status_code == 403
    assert (await client.get("/admin/audit", headers=headers)).status_code == 403


async def test_admin_metrics_and_events_shape_for_admin(client, db):
    tokens = await register_user(client)
    await _promote_to_admin(db, "alice@example.com")
    headers = auth_headers(tokens["access_token"])

    metrics_resp = await client.get("/admin/metrics", headers=headers)
    assert metrics_resp.status_code == 200
    metrics = metrics_resp.json()
    assert metrics.keys() >= {
        "total",
        "allowed",
        "blocked",
        "neutralized",
        "by_attack_type",
        "by_source_type",
    }

    events_resp = await client.get("/admin/events?n=10", headers=headers)
    assert events_resp.status_code == 200
    assert isinstance(events_resp.json(), list)


async def test_admin_audit_returns_paginated_rows_without_raw_text(client, db):
    tokens = await register_user(client)
    await _promote_to_admin(db, "alice@example.com")
    headers = auth_headers(tokens["access_token"])

    user = (await db.execute(select(User).where(User.email == "alice@example.com"))).scalar_one()
    db.add(
        AuditLog(
            user_id=user.id,
            event_type="test_admin_audit_case",
            input_hash="deadbeef",
            decision="BLOCK",
            metadata_={"attack_type": "instruction_override", "source_type": "user_message"},
        )
    )
    await db.commit()

    resp = await client.get("/admin/audit?event_type=test_admin_audit_case", headers=headers)
    assert resp.status_code == 200
    body = resp.json()

    assert body["total"] == 1
    assert len(body["items"]) == 1
    row = body["items"][0]
    assert row["input_hash"] == "deadbeef"
    assert row["decision"] == "BLOCK"
    assert row["metadata"] == {
        "attack_type": "instruction_override",
        "source_type": "user_message",
    }
    assert "input_text" not in row
