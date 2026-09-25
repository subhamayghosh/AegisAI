from __future__ import annotations

from tests.conftest import auth_headers, register_user


async def test_get_me(client):
    tokens = await register_user(client)
    resp = await client.get("/users/me", headers=auth_headers(tokens["access_token"]))
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "alice@example.com"
    assert body["display_name"] == "Alice"
    assert body["role"] == "user"


async def test_patch_display_name(client):
    tokens = await register_user(client)
    resp = await client.patch(
        "/users/me",
        json={"display_name": "Alice Renamed"},
        headers=auth_headers(tokens["access_token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Alice Renamed"


async def test_patch_email_is_rejected(client):
    tokens = await register_user(client)
    resp = await client.patch(
        "/users/me",
        json={"email": "hacker@example.com"},
        headers=auth_headers(tokens["access_token"]),
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Email is immutable"


async def test_password_change_happy_path(client):
    tokens = await register_user(client)
    resp = await client.post(
        "/users/me/password",
        json={"current_password": "SuperSecret123!", "new_password": "BrandNewPass456!"},
        headers=auth_headers(tokens["access_token"]),
    )
    assert resp.status_code == 204

    # New password now works
    login = await client.post(
        "/auth/login",
        json={"email": "alice@example.com", "password": "BrandNewPass456!"},
    )
    assert login.status_code == 200


async def test_password_change_wrong_current(client):
    tokens = await register_user(client)
    resp = await client.post(
        "/users/me/password",
        json={"current_password": "WrongPass000!", "new_password": "BrandNewPass456!"},
        headers=auth_headers(tokens["access_token"]),
    )
    assert resp.status_code == 400


async def test_password_change_revokes_refresh_tokens(client):
    tokens = await register_user(client)

    resp = await client.post(
        "/users/me/password",
        json={"current_password": "SuperSecret123!", "new_password": "BrandNewPass456!"},
        headers=auth_headers(tokens["access_token"]),
    )
    assert resp.status_code == 204

    # The original refresh token must now be invalid.
    r = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 401
