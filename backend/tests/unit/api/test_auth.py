from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from jose import jwt

from aegisai.config import get_settings
from aegisai.db.models import User
from aegisai.security.deps import require_admin
from tests.conftest import auth_headers, login_user, register_user


# 1
async def test_register_happy_path(client):
    resp = await client.post(
        "/auth/register",
        json={
            "email": "Alice@Example.com",
            "password": "SuperSecret123!",
            "display_name": "Alice",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["user"]["email"] == "alice@example.com"  # lower-cased
    assert body["user"]["role"] == "user"
    assert body["access_token"]
    assert body["refresh_token"]


# 2
async def test_register_duplicate_email(client):
    await register_user(client)
    resp = await client.post(
        "/auth/register",
        json={
            "email": "alice@example.com",
            "password": "AnotherPass456!",
            "display_name": "Alice 2",
        },
    )
    assert resp.status_code == 409


# 3
async def test_login_happy_path(client):
    await register_user(client)
    resp = await client.post(
        "/auth/login",
        json={"email": "alice@example.com", "password": "SuperSecret123!"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "alice@example.com"
    assert body["access_token"]
    assert body["refresh_token"]


# 4
async def test_login_wrong_password(client):
    await register_user(client)
    resp = await client.post(
        "/auth/login",
        json={"email": "alice@example.com", "password": "WrongPass000!"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials"


# 5
async def test_login_unknown_email(client):
    resp = await client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "anything123"},
    )
    assert resp.status_code == 401


# 6
async def test_login_rate_limit(rl_client):
    # Register once (uses the 3/min register limit — one out of three).
    await register_user(rl_client)

    # Now hammer /login with the wrong password.  Limit is 5/min/IP.
    for _ in range(5):
        r = await rl_client.post(
            "/auth/login",
            json={"email": "alice@example.com", "password": "wrong!!"},
        )
        assert r.status_code == 401

    r = await rl_client.post(
        "/auth/login",
        json={"email": "alice@example.com", "password": "wrong!!"},
    )
    assert r.status_code == 429


# 7
async def test_refresh_rotates_token(client):
    tokens = await register_user(client)
    old_refresh = tokens["refresh_token"]

    resp = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 200
    new_tokens = resp.json()
    assert new_tokens["access_token"]
    assert new_tokens["refresh_token"]
    assert new_tokens["refresh_token"] != old_refresh


# 8
async def test_refresh_token_is_single_use(client):
    tokens = await register_user(client)
    old_refresh = tokens["refresh_token"]

    r1 = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert r1.status_code == 200

    # Reusing the same refresh token must fail.
    r2 = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert r2.status_code == 401


# 9
async def test_logout_revokes_refresh_tokens(client):
    tokens = await register_user(client)

    resp = await client.post("/auth/logout", headers=auth_headers(tokens["access_token"]))
    assert resp.status_code == 204

    # The refresh token from register should now be revoked.
    r = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 401


# 10
async def test_protected_endpoint_without_token(client):
    resp = await client.get("/users/me")
    assert resp.status_code == 401


# 11
async def test_expired_access_token_rejected(client):
    await register_user(client)
    s = get_settings()

    # Manually craft an already-expired access token.
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "00000000-0000-0000-0000-000000000000",
        "typ": "access",
        "iat": int((now - timedelta(hours=2)).timestamp()),
        "exp": int((now - timedelta(hours=1)).timestamp()),
    }
    expired = jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_alg)

    resp = await client.get("/users/me", headers=auth_headers(expired))
    assert resp.status_code == 401


# 12
async def test_require_admin_dependency():
    user_role = User(
        email="u@example.com",
        password_hash="x",
        display_name="U",
        role="user",
    )
    admin_role = User(
        email="a@example.com",
        password_hash="x",
        display_name="A",
        role="admin",
    )

    with pytest.raises(HTTPException) as exc:
        await require_admin(user=user_role)
    assert exc.value.status_code == 403

    returned = await require_admin(user=admin_role)
    assert returned is admin_role
