from fastapi.testclient import TestClient

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
