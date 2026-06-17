from fastapi import APIRouter
from pydantic import BaseModel
from services.firestore_service import save_footprint, get_footprint_history
from datetime import datetime

router = APIRouter()

class FootprintInput(BaseModel):
    session_id: str          # random UUID from frontend localStorage
    car_km: float
    flights: int
    diet_type: str           # vegan/vegetarian/mixed/meat-heavy
    electricity_bill: float  # INR per month
    ac_usage: bool
    cooking_fuel: str        # lpg/electric/induction
    online_orders: int

class FootprintResult(BaseModel):
    total_co2: float
    travel: float
    food: float
    energy: float
    shopping: float
    timestamp: str

@router.post("/calculate")
async def calculate_footprint(data: FootprintInput):
    """
    Calculate the user's annual carbon footprint using India-specific emission factors.

    Args:
        data: FootprintInput containing travel, diet, energy, and shopping inputs.

    Returns:
        dict: Breakdown of CO₂ emissions by category (tonnes/year) and total.

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
async def get_history(session_id: str):
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
