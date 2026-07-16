import pytest
from fastapi.testclient import TestClient

from services.order_service.app import routes
from services.order_service.app.main import app


class MockResponse:
    def raise_for_status(self):
        pass

async def mock_post(*args, **kwargs):
    return MockResponse()

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(routes, "_emit_event", lambda *args, **kwargs: None)
    monkeypatch.setattr("services.order_service.app.producer.producer.initialize", lambda: None)
    monkeypatch.setattr("services.order_service.app.producer.producer.close", lambda: None)
    monkeypatch.setattr("services.order_service.app.http_client.http_client.post", mock_post)
    with TestClient(app) as test_client:
        yield test_client


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_health_endpoint(client):
    response = client.get("/orders/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_create_order_returns_201(client):
    response = client.post(
        "/orders",
        json={"order_id": "ord-001", "customer_id": "cust-1", "amount": 99.99},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "created"


def test_get_existing_order(client):
    client.post(
        "/orders",
        json={"order_id": "ord-002", "customer_id": "cust-2", "amount": 50.0},
    )
    response = client.get("/orders/ord-002")
    assert response.status_code == 200
    assert response.json()["order_id"] == "ord-002"


def test_get_missing_order_returns_404(client):
    response = client.get("/orders/does-not-exist")
    assert response.status_code == 404


def test_create_order_emits_real_status_code(monkeypatch):
    """The emitted Kafka event must carry the real HTTP status, not a hardcoded 'success'."""
    captured = {}

    def fake_emit(request, event_name, status_code, response_time_ms, order_id=None):
        captured["status_code"] = status_code

    monkeypatch.setattr(routes, "_emit_event", fake_emit)

    with TestClient(routes.router) as test_client:
        response = test_client.post(
            "/orders",
            json={"order_id": "ord-003", "customer_id": "cust-3", "amount": 10.0},
        )

    assert response.status_code == 201
    assert captured["status_code"] == 201


def test_get_missing_order_emits_404_status_code(monkeypatch):
    """A 404 for a missing order must propagate into the emitted Kafka event."""
    captured = {}

    def fake_emit(request, event_name, status_code, response_time_ms, order_id=None):
        captured["status_code"] = status_code

    monkeypatch.setattr(routes, "_emit_event", fake_emit)

    with TestClient(routes.router) as test_client:
        test_client.get("/orders/nonexistent-id")

    assert captured["status_code"] == 404
