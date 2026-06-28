"""Tests for health check endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check_root() -> None:
    """Test health check at root level."""

    response = client.get("/healthz")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["message"] == "Service is healthy"


def test_health_check_api() -> None:
    """Test health check at API level."""

    response = client.get("/api/v1/healthz")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["message"] == "Service is healthy"


def test_root_endpoint() -> None:
    """Test root API endpoint."""

    response = client.get("/api/v1/")
    assert response.status_code == 200

    data = response.json()
    assert data["message"] == "HTHGSE Shewhart Chatbot API"
    assert data["version"] == "0.1.0"
    assert data["status"] == "running"


def test_health_check_response_structure() -> None:
    """Test that health check response has correct structure."""

    response = client.get("/healthz")
    data = response.json()

    # Check required fields
    assert "status" in data
    assert "message" in data

    # Check field types
    assert isinstance(data["status"], str)
    assert isinstance(data["message"], str)

    # Check values
    assert data["status"] == "ok"
    assert len(data["message"]) > 0
