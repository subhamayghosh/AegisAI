from __future__ import annotations

from types import SimpleNamespace

from aegisai.config import (
    DEFAULT_JUDGE_MODEL,
    DEFAULT_WORKING_MODEL,
    resolve_model_ids,
)
from tests.conftest import auth_headers, register_user


# 1
async def test_defaults_on_register(client):
    tokens = await register_user(client)
    resp = await client.get("/users/me/settings", headers=auth_headers(tokens["access_token"]))
    assert resp.status_code == 200
    body = resp.json()

    assert body["working_model_id"] is None
    assert body["judge_model_id"] is None
    assert body["effective"]["working"] == DEFAULT_WORKING_MODEL
    assert body["effective"]["judge"] == DEFAULT_JUDGE_MODEL


# 2
async def test_set_custom_working_model(client):
    tokens = await register_user(client)
    hdrs = auth_headers(tokens["access_token"])

    r = await client.put(
        "/users/me/settings",
        json={"working_model_id": "claude-haiku-4-5-20251001"},
        headers=hdrs,
    )
    assert r.status_code == 200

    g = await client.get("/users/me/settings", headers=hdrs)
    body = g.json()
    assert body["working_model_id"] == "claude-haiku-4-5-20251001"
    assert body["effective"]["working"] == "claude-haiku-4-5-20251001"


# 3
async def test_set_custom_judge_model(client):
    tokens = await register_user(client)
    hdrs = auth_headers(tokens["access_token"])

    r = await client.put(
        "/users/me/settings",
        json={"judge_model_id": "claude-opus-5-5"},
        headers=hdrs,
    )
    assert r.status_code == 200

    g = await client.get("/users/me/settings", headers=hdrs)
    body = g.json()
    assert body["judge_model_id"] == "claude-opus-5-5"
    assert body["effective"]["judge"] == "claude-opus-5-5"


# 4
async def test_unknown_working_model_id_rejected(client):
    tokens = await register_user(client)
    r = await client.put(
        "/users/me/settings",
        json={"working_model_id": "gpt-4"},
        headers=auth_headers(tokens["access_token"]),
    )
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert "working_model_id" in detail
    assert "claude-sonnet-5" in detail  # allowlist surfaced in the message


# 5
async def test_judge_model_cannot_be_haiku(client):
    tokens = await register_user(client)
    # Haiku is in the working allowlist but deliberately excluded from judge.
    r = await client.put(
        "/users/me/settings",
        json={"judge_model_id": "claude-haiku-4-5-20251001"},
        headers=auth_headers(tokens["access_token"]),
    )
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert "judge_model_id" in detail
    assert "claude-haiku" not in detail  # Haiku not in the allowed list surfaced


# 6
async def test_explicit_null_clears_choice(client):
    tokens = await register_user(client)
    hdrs = auth_headers(tokens["access_token"])

    # First set a custom value
    await client.put(
        "/users/me/settings",
        json={"working_model_id": "claude-opus-5-5"},
        headers=hdrs,
    )
    # Now explicitly clear it
    r = await client.put(
        "/users/me/settings",
        json={"working_model_id": None},
        headers=hdrs,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["working_model_id"] is None
    assert body["effective"]["working"] == DEFAULT_WORKING_MODEL


# 7
async def test_available_models_endpoint(client):
    tokens = await register_user(client)
    r = await client.get(
        "/users/me/settings/available-models",
        headers=auth_headers(tokens["access_token"]),
    )
    assert r.status_code == 200
    body = r.json()

    assert body["defaults"]["working"] == DEFAULT_WORKING_MODEL
    assert body["defaults"]["judge"] == DEFAULT_JUDGE_MODEL

    working_ids = [m["id"] for m in body["working"]]
    judge_ids = [m["id"] for m in body["judge"]]

    assert "claude-sonnet-5" in working_ids
    assert "claude-haiku-4-5-20251001" in working_ids
    # Haiku must not be in the judge list
    assert "claude-haiku-4-5-20251001" not in judge_ids
    assert "claude-opus-4-7" in judge_ids

    for m in body["working"] + body["judge"]:
        assert m["label"]
        assert m["description"]


# 8
async def test_threshold_out_of_range_rejected(client):
    tokens = await register_user(client)
    r = await client.put(
        "/users/me/settings",
        json={"tier2_threshold": 0.3},
        headers=auth_headers(tokens["access_token"]),
    )
    assert r.status_code == 422


# 9
def test_resolve_model_ids_unit():
    # With no user settings, we get the in-code defaults.
    working, judge = resolve_model_ids(None)
    assert working == DEFAULT_WORKING_MODEL
    assert judge == DEFAULT_JUDGE_MODEL

    # Per-user overrides win.
    us = SimpleNamespace(
        working_model_id="claude-opus-5-5",
        judge_model_id="claude-sonnet-5",
    )
    working, judge = resolve_model_ids(us)
    assert working == "claude-opus-5-5"
    assert judge == "claude-sonnet-5"

    # Null-per-field falls back to the app default for that field only.
    us_partial = SimpleNamespace(working_model_id="claude-opus-5-5", judge_model_id=None)
    working, judge = resolve_model_ids(us_partial)
    assert working == "claude-opus-5-5"
    assert judge == DEFAULT_JUDGE_MODEL
