import pytest
from fastapi.testclient import TestClient

from aegisai.core import pipeline
from aegisai.main import app

client = TestClient(app)


def test_health_returns_200() -> None:
    response = client.get("/health")
    assert response.status_code == 200


def test_health_has_expected_keys() -> None:
    data = client.get("/health").json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "working_model" in data
    assert "judge_model" in data


def test_health_model_values_are_strings() -> None:
    data = client.get("/health").json()
    assert isinstance(data["working_model"], str)
    assert isinstance(data["judge_model"], str)
    assert len(data["working_model"]) > 0
    assert len(data["judge_model"]) > 0


@pytest.mark.asyncio
async def test_lifespan_does_not_wait_for_tier2(monkeypatch: pytest.MonkeyPatch) -> None:
    """Authentication must not be held behind a cold embedding-model load."""
    started = False

    def fake_warm_up() -> None:
        nonlocal started
        started = True

    async def unexpected_wait(*args: object, **kwargs: object) -> str:
        pytest.fail("application startup must not wait for Tier 2 readiness")

    monkeypatch.setattr(pipeline, "warm_up", fake_warm_up)
    monkeypatch.setattr(pipeline, "wait_for_tier2", unexpected_wait)

    async with app.router.lifespan_context(app):
        assert started
