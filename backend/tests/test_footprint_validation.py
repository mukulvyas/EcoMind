"""
Tests for FootprintInput Pydantic field validators.

Verifies that out-of-range inputs are rejected with HTTP 422 and that
all four diet types yield the expected CO₂ values.

Uses a unique session UUID per test to avoid rate-limit 429 collisions.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

VALID_SESSION = "123e4567-e89b-12d3-a456-426614174000"


def fresh() -> dict[str, str]:
    """Return a fresh unique session header to avoid hitting the rate limiter."""
    return {"X-Session-ID": str(uuid.uuid4())}


def make_payload(**overrides) -> dict:
    """Return a valid base payload with optional field overrides."""
    base = {
        "session_id": str(uuid.uuid4()),
        "car_km": 100,
        "flights": 2,
        "diet_type": "mixed",
        "electricity_bill": 1500,
        "ac_usage": False,
        "cooking_fuel": "lpg",
        "online_orders": 2,
    }
    base.update(overrides)
    return base


# ─── car_km field validation ───────────────────────────────────────────────────

def test_negative_car_km_rejected():
    """car_km below 0 must be rejected with HTTP 422."""
    response = client.post(
        "/api/footprint/calculate",
        headers=fresh(),
        json=make_payload(car_km=-10)
    )
    assert response.status_code == 422, f"Expected 422, got {response.status_code}"


def test_car_km_exceeds_max_rejected():
    """car_km above 5000 must be rejected with HTTP 422."""
    response = client.post(
        "/api/footprint/calculate",
        headers=fresh(),
        json=make_payload(car_km=9999)
    )
    assert response.status_code == 422


def test_car_km_zero_accepted():
    """car_km of exactly 0 must be accepted."""
    response = client.post(
        "/api/footprint/calculate",
        headers=fresh(),
        json=make_payload(car_km=0)
    )
    assert response.status_code == 200


def test_car_km_max_boundary_accepted():
    """car_km of exactly 5000 must be accepted."""
    response = client.post(
        "/api/footprint/calculate",
        headers=fresh(),
        json=make_payload(car_km=5000)
    )
    assert response.status_code == 200


# ─── flights field validation ──────────────────────────────────────────────────

def test_negative_flights_rejected():
    """flights below 0 must be rejected."""
    response = client.post(
        "/api/footprint/calculate",
        headers=fresh(),
        json=make_payload(flights=-1)
    )
    assert response.status_code == 422


def test_flights_above_max_rejected():
    """flights above 50 must be rejected."""
    response = client.post(
        "/api/footprint/calculate",
        headers=fresh(),
        json=make_payload(flights=100)
    )
    assert response.status_code == 422


def test_flights_zero_accepted():
    """flights of 0 is a valid no-fly scenario."""
    response = client.post(
        "/api/footprint/calculate",
        headers=fresh(),
        json=make_payload(flights=0)
    )
    assert response.status_code == 200


# ─── electricity_bill field validation ─────────────────────────────────────────

def test_negative_electricity_bill_rejected():
    """Negative electricity_bill must be rejected."""
    response = client.post(
        "/api/footprint/calculate",
        headers=fresh(),
        json=make_payload(electricity_bill=-500)
    )
    assert response.status_code == 422


def test_electricity_bill_above_max_rejected():
    """electricity_bill above 100 000 must be rejected."""
    response = client.post(
        "/api/footprint/calculate",
        headers=fresh(),
        json=make_payload(electricity_bill=200_000)
    )
    assert response.status_code == 422


# ─── online_orders field validation ───────────────────────────────────────────

def test_negative_online_orders_rejected():
    """online_orders below 0 must be rejected."""
    response = client.post(
        "/api/footprint/calculate",
        headers=fresh(),
        json=make_payload(online_orders=-5)
    )
    assert response.status_code == 422


def test_online_orders_above_max_rejected():
    """online_orders above 200 must be rejected."""
    response = client.post(
        "/api/footprint/calculate",
        headers=fresh(),
        json=make_payload(online_orders=500)
    )
    assert response.status_code == 422


# ─── Diet-type CO₂ precision tests ────────────────────────────────────────────

def _calc(diet_type: str) -> dict:
    """Helper to calculate footprint with all-zero non-diet inputs."""
    session_id = str(uuid.uuid4())
    payload = {
        "session_id": session_id,
        "car_km": 0, "flights": 0,
        "diet_type": diet_type,
        "electricity_bill": 0, "ac_usage": False,
        "cooking_fuel": "electric", "online_orders": 0,
    }
    r = client.post("/api/footprint/calculate", headers=fresh(), json=payload)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    return r.json()


def test_diet_vegan_gives_correct_co2():
    """Vegan diet with zero other inputs → exactly 0.5T food."""
    data = _calc("vegan")
    assert abs(data["food"] - 0.5) < 0.01


def test_diet_vegetarian_gives_correct_co2():
    """Vegetarian diet with zero other inputs → exactly 0.7T food."""
    data = _calc("vegetarian")
    assert abs(data["food"] - 0.7) < 0.01


def test_diet_mixed_gives_correct_co2():
    """Mixed diet with zero other inputs → exactly 1.2T food."""
    data = _calc("mixed")
    assert abs(data["food"] - 1.2) < 0.01


def test_diet_meat_heavy_gives_correct_co2():
    """Meat-heavy diet with zero other inputs → exactly 1.8T food."""
    data = _calc("meat-heavy")
    assert abs(data["food"] - 1.8) < 0.01


def test_unknown_diet_falls_back_to_mixed():
    """Unknown diet_type falls back to mixed (1.2T) without crashing."""
    data = _calc("unknown_diet_xyz")
    assert abs(data["food"] - 1.2) < 0.01


# ─── Cooking fuel tests ────────────────────────────────────────────────────────

def test_lpg_cooking_adds_energy():
    """LPG cooking_fuel adds 0.22T to energy vs electric (with zero other inputs)."""
    electric_payload = {
        "session_id": str(uuid.uuid4()),
        "car_km": 0, "flights": 0, "diet_type": "vegan",
        "electricity_bill": 0, "ac_usage": False,
        "cooking_fuel": "electric", "online_orders": 0,
    }
    lpg_payload = {**electric_payload, "session_id": str(uuid.uuid4()), "cooking_fuel": "lpg"}
    r_elec = client.post("/api/footprint/calculate", headers=fresh(), json=electric_payload)
    r_lpg = client.post("/api/footprint/calculate", headers=fresh(), json=lpg_payload)
    assert r_elec.status_code == 200
    assert r_lpg.status_code == 200
    diff = r_lpg.json()["energy"] - r_elec.json()["energy"]
    assert abs(diff - 0.22) < 0.01


def test_all_zero_inputs_give_minimum_footprint():
    """All-zero inputs (vegan, electric, 0 km) produce the minimum food-only footprint."""
    data = _calc("vegan")
    assert data["travel"] == 0.0
    assert data["energy"] == 0.0
    assert data["shopping"] == 0.0
    assert data["food"] > 0
