"""
Tests for security middleware — session validation, rate limiting, CORS, and input sanitization.
"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

VALID_SESSION = "123e4567-e89b-12d3-a456-426614174000"
VALID_HEADERS = {"X-Session-ID": VALID_SESSION}


# ─── Session ID validation ──────────────────────────────────────────────────────

def test_missing_session_header_returns_400():
    """Any non-GET, non-health endpoint without X-Session-ID must return 400."""
    response = client.post("/api/footprint/calculate", json={
        "session_id": VALID_SESSION,
        "car_km": 100, "flights": 1, "diet_type": "mixed",
        "electricity_bill": 1000, "ac_usage": False,
        "cooking_fuel": "lpg", "online_orders": 2
    })
    assert response.status_code == 400
    assert "error" in response.json()


def test_empty_session_header_returns_400():
    """An empty string X-Session-ID must be rejected."""
    response = client.post(
        "/api/footprint/calculate",
        headers={"X-Session-ID": ""},
        json={
            "session_id": "", "car_km": 50, "flights": 0,
            "diet_type": "vegan", "electricity_bill": 500,
            "ac_usage": False, "cooking_fuel": "electric", "online_orders": 0
        }
    )
    assert response.status_code == 400


def test_sql_injection_in_session_rejected():
    """SQL injection attempt in session ID must be rejected."""
    response = client.get(
        "/api/footprint/history/1' OR '1'='1",
        headers={"X-Session-ID": "1' OR '1'='1"}
    )
    assert response.status_code == 400


def test_script_injection_in_session_rejected():
    """Script tag injection in session ID must be rejected."""
    response = client.get(
        "/api/footprint/history/<script>alert(1)</script>",
        headers={"X-Session-ID": "<script>alert(1)</script>"}
    )
    assert response.status_code == 400


def test_very_long_session_rejected():
    """Extremely long strings as session ID must be rejected."""
    long_str = "a" * 500
    response = client.get(
        f"/api/footprint/history/{long_str}",
        headers={"X-Session-ID": long_str}
    )
    assert response.status_code == 400


# ─── Health check ──────────────────────────────────────────────────────────────

def test_health_check_no_auth_needed():
    """GET /health should work without any session header."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "EcoMind API"


def test_health_check_returns_version():
    """Health check must include version field."""
    response = client.get("/health")
    assert "version" in response.json()


# ─── CORS behaviour ────────────────────────────────────────────────────────────

def test_cors_allows_localhost():
    """Localhost origin must pass the CORS check."""
    response = client.options(
        "/api/govt/live",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-Session-ID",
        }
    )
    assert response.status_code in (200, 204)


def test_cors_allows_cloud_run_regional_url():
    """Cloud Run regional URLs (*.region.run.app) must pass CORS."""
    response = client.options(
        "/api/govt/live",
        headers={
            "Origin": "https://ecomind-frontend-700261159057.europe-west1.run.app",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-Session-ID",
        }
    )
    assert response.status_code in (200, 204)


def test_cors_blocks_unknown_origin():
    """An unknown origin must not receive an Access-Control-Allow-Origin header."""
    response = client.options(
        "/api/govt/live",
        headers={
            "Origin": "https://evil-hacker.com",
            "Access-Control-Request-Method": "GET",
        }
    )
    # Either 204 with empty ACAO or blocked entirely — ACAO must not be evil-hacker.com
    acao = response.headers.get("access-control-allow-origin", "")
    assert "evil-hacker.com" not in acao


# ─── Rate limiting ─────────────────────────────────────────────────────────────

def test_rate_limit_triggers_after_30_requests():
    """Sending 35 rapid requests from one session must trigger 429."""
    session = "bbbbcccc-dddd-eeee-ffff-aaaaaaaaaaaa"
    headers = {"X-Session-ID": session}
    statuses = [
        client.get(f"/api/footprint/history/{session}", headers=headers).status_code
        for _ in range(35)
    ]
    assert 429 in statuses


# ─── Input validation ──────────────────────────────────────────────────────────

def test_negative_car_km_handled():
    """Negative car_km should still process (business logic handles it, not 500)."""
    response = client.post(
        "/api/footprint/calculate",
        headers=VALID_HEADERS,
        json={
            "session_id": VALID_SESSION,
            "car_km": -100, "flights": 0,
            "diet_type": "vegan", "electricity_bill": 0,
            "ac_usage": False, "cooking_fuel": "electric", "online_orders": 0
        }
    )
    # Should not crash — 200 or 422 (validation), never 500
    assert response.status_code != 500


def test_unknown_diet_type_uses_fallback():
    """Unknown diet_type falls back to mixed (1.2T) without crashing."""
    response = client.post(
        "/api/footprint/calculate",
        headers=VALID_HEADERS,
        json={
            "session_id": VALID_SESSION,
            "car_km": 0, "flights": 0,
            "diet_type": "unknown_diet_xyz", "electricity_bill": 0,
            "ac_usage": False, "cooking_fuel": "electric", "online_orders": 0
        }
    )
    assert response.status_code == 200
    assert response.json()["food"] == 1.2


def test_govt_endpoint_default_city():
    """Govt endpoint with no params should default to Bengaluru/Karnataka."""
    response = client.get(
        "/api/govt/live",
        headers=VALID_HEADERS
    )
    assert response.status_code == 200
    data = response.json()
    assert data["aqi"]["aqi"] == 89  # Bengaluru default AQI


def test_govt_endpoint_unknown_city_uses_default():
    """Govt endpoint with an unknown city must use default values, not crash."""
    response = client.get(
        "/api/govt/live?city=NonExistentCity&state=FakeState",
        headers=VALID_HEADERS
    )
    assert response.status_code == 200
    data = response.json()
    assert "grid" in data
    assert "aqi" in data
