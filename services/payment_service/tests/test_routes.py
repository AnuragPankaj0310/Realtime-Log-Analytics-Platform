import pytest
from fastapi.testclient import TestClient

from services.payment_service.app import routes
from services.payment_service.app.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(routes, "_emit_event", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        "services.payment_service.app.producer.producer.initialize", lambda: None
    )
    monkeypatch.setattr(
        "services.payment_service.app.producer.producer.close", lambda: None
    )
    with TestClient(app) as test_client:
        yield test_client


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_health_endpoint(client):
    response = client.get("/payments/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_create_payment_returns_201(client):
    response = client.post(
        "/payments",
        json={"payment_id": "pay-001", "order_id": "ord-001", "amount": 49.99},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "created"


def test_get_existing_payment(client):
    client.post(
        "/payments",
        json={"payment_id": "pay-002", "order_id": "ord-002", "amount": 25.0},
    )
    response = client.get("/payments/pay-002")
    assert response.status_code == 200
    assert response.json()["payment_id"] == "pay-002"


def test_get_missing_payment_returns_404(client):
    response = client.get("/payments/does-not-exist")
    assert response.status_code == 404


def test_create_payment_emits_real_status_code(monkeypatch, client):
    """The emitted Kafka event must carry the real HTTP status, not a hardcoded 'success'."""
    captured = {}

    def fake_emit(request, event_name, status_code, *args, **kwargs):
        captured["status_code"] = status_code

    monkeypatch.setattr(routes, "_emit_event", fake_emit)

    response = client.post(
        "/payments",
        json={"payment_id": "pay-003", "order_id": "ord-003", "amount": 10.0},
    )

    assert response.status_code == 201
    assert captured["status_code"] == 201


def test_get_missing_payment_emits_404_status_code(monkeypatch, client):
    """A 404 for a missing payment must propagate into the emitted Kafka event."""
    captured = {}

    def fake_emit(request, event_name, status_code, *args, **kwargs):
        captured["status_code"] = status_code

    monkeypatch.setattr(routes, "_emit_event", fake_emit)

    client.get("/payments/nonexistent-id")

    assert captured["status_code"] == 404
