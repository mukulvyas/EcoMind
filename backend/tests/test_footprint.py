import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200

def test_calculate_footprint_valid():
    response = client.post("/api/footprint/calculate",
        headers={"X-Session-ID": "123e4567-e89b-12d3-a456-426614174000"},
        json={
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "car_km": 100,
            "flights": 2,
            "diet_type": "mixed",
            "electricity_bill": 1500,
            "ac_usage": True,
            "cooking_fuel": "lpg",
            "online_orders": 4
        })
    assert response.status_code == 200
    data = response.json()
    assert "total_co2" in data
    assert data["total_co2"] > 0
    assert "travel" in data
    assert "food" in data
    assert "energy" in data
    assert "shopping" in data

def test_calculate_footprint_vegan_lower():
    vegan = client.post("/api/footprint/calculate",
        headers={"X-Session-ID": "123e4567-e89b-12d3-a456-426614174000"},
        json={
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "car_km": 0, "flights": 0,
            "diet_type": "vegan",
            "electricity_bill": 500,
            "ac_usage": False,
            "cooking_fuel": "electric",
            "online_orders": 0
        })
    meat = client.post("/api/footprint/calculate",
        headers={"X-Session-ID": "123e4567-e89b-12d3-a456-426614174000"},
        json={
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "car_km": 0, "flights": 0,
            "diet_type": "meat-heavy",
            "electricity_bill": 500,
            "ac_usage": False,
            "cooking_fuel": "electric",
            "online_orders": 0
        })
    assert vegan.json()["food"] < meat.json()["food"]

def test_invalid_session_id():
    response = client.post("/api/footprint/calculate",
        headers={"X-Session-ID": "not-a-valid-uuid"},
        json={
            "session_id": "not-a-valid-uuid",
            "car_km": 100,
            "flights": 2,
            "diet_type": "mixed",
            "electricity_bill": 1500,
            "ac_usage": True,
            "cooking_fuel": "lpg",
            "online_orders": 4
        })
    assert response.status_code == 400

def test_carbon_calculations_accuracy():
    response = client.post("/api/footprint/calculate",
        headers={"X-Session-ID": "123e4567-e89b-12d3-a456-426614174000"},
        json={
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "car_km": 0, "flights": 0,
            "diet_type": "mixed",
            "electricity_bill": 0,
            "ac_usage": False,
            "cooking_fuel": "electric",
            "online_orders": 0
        })
    data = response.json()
    # diet mixed = exactly 1.2 tonnes
    assert abs(data["food"] - 1.2) < 0.01

def test_govt_data_endpoint():
    response = client.get(
        "/api/govt/live?city=Bengaluru&state=Karnataka",
        headers={"X-Session-ID": "123e4567-e89b-12d3-a456-426614174000"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "grid" in data
    assert "aqi" in data
    assert "weather" in data
    assert "national" in data

def test_footprint_history_empty():
    response = client.get(
        "/api/footprint/history/123e4567-e89b-12d3-a456-426614174999",
        headers={"X-Session-ID": "123e4567-e89b-12d3-a456-426614174999"}
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
