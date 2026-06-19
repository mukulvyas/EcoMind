"""
Carbon footprint calculation router.

Exposes endpoints for computing a user's annual CO₂ footprint using
India-specific emission factors (CEA, PPAC, MoEFCC sources) and persisting
results to Firestore for trend tracking.
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional
from services.firestore_service import save_footprint, get_footprint_history
from datetime import datetime

router = APIRouter()

class FootprintInput(BaseModel):
    """Input schema for the carbon footprint calculator."""
    session_id: str = Field(..., description="Random UUID from frontend localStorage")
    car_km: float = Field(..., ge=0, le=5000, description="Weekly car usage in km (0–5000)")
    flights: int = Field(..., ge=0, le=50, description="Flights per year (0–50)")
    diet_type: str = Field(
        ...,
        description="Diet category: 'vegan', 'vegetarian', 'mixed', or 'meat-heavy'"
    )
    electricity_bill: float = Field(
        ..., ge=0, le=100_000,
        description="Monthly electricity bill in INR (0–100 000)"
    )
    ac_usage: bool = Field(..., description="Whether air conditioning is regularly used")
    cooking_fuel: str = Field(
        ...,
        description="Primary cooking fuel: 'lpg', 'electric', or 'induction'"
    )
    online_orders: int = Field(
        ..., ge=0, le=200,
        description="Average online orders per month (0–200)"
    )

class FootprintResult(BaseModel):
    """Computed annual carbon footprint broken down by category."""
    total_co2: float
    travel: float
    food: float
    energy: float
    shopping: float
    timestamp: str

@router.post("/calculate")
async def calculate_footprint(data: FootprintInput) -> dict:
    """
    Calculate the user's annual carbon footprint using India-specific emission factors.

    Factors used:
    - Travel: 0.192 kg CO₂/km (petrol car) × weekly km × 52 weeks + 0.255T/flight
    - Food: diet-based annual factor (vegan 0.5T → meat-heavy 1.8T)
    - Energy: Karnataka grid factor 0.82 kg CO₂/kWh; AC +0.35T; LPG +0.22T
    - Shopping: 0.012T per online order per year

    Args:
        data: FootprintInput containing travel, diet, energy, and shopping inputs.

    Returns:
        dict: Breakdown of CO₂ emissions by category (tonnes/year) and total,
              including session_id and ISO timestamp.

    Raises:
        HTTPException: If Firestore save fails (handled gracefully, does not raise).
    """
    # Carbon calculation logic (India-specific factors)
    travel = (data.car_km / 1000) * 0.192 * 52 + data.flights * 0.255
    food_map = {"vegan": 0.5, "vegetarian": 0.7, "mixed": 1.2, "meat-heavy": 1.8}
    food = food_map.get(data.diet_type, 1.2)
    # Karnataka grid factor: 0.82 kg CO2/kWh
    kwh_per_month = data.electricity_bill / 8
    energy = kwh_per_month * 0.82 * 0.001 * 12
    if data.ac_usage:
        energy += 0.35
    if data.cooking_fuel == "lpg":
        energy += 0.22
    shopping = data.online_orders * 0.012 * 12
    total = round(travel + food + energy + shopping, 2)

    result = {
        "session_id": data.session_id,
        "total_co2": total,
        "travel": round(travel, 2),
        "food": round(food, 2),
        "energy": round(energy, 2),
        "shopping": round(shopping, 2),
        "timestamp": datetime.utcnow().isoformat()
    }
    await save_footprint(data.session_id, result)
    return result

@router.get("/history/{session_id}")
async def get_history(session_id: str) -> list:
    """
    Retrieve the carbon footprint history for a given session.

    Args:
        session_id: UUID identifying the user's browser session.

    Returns:
        list: Up to 8 most recent footprint entries, ordered newest-first.

    Raises:
        HTTPException: If Firestore read fails (handled gracefully, returns empty list).
    """
    entries = await get_footprint_history(session_id)
    return entries
