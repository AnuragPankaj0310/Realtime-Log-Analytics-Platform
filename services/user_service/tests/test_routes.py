import pytest
from fastapi.testclient import TestClient

from services.user_service.app import routes
from services.user_service.app.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(routes, "publish_event", lambda event: True)
    with TestClient(app) as test_client:
        yield test_client


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_login_endpoint(client):
    response = client.post(
        "/login",
        json={"email": "user@example.com", "password": "secret"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_signup_endpoint(client):
    response = client.post(
        "/signup",
        json={"email": "user@example.com", "password": "secret", "name": "Test User"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"
