from fastapi import APIRouter
from services.govt_service import (
    get_grid_emission_factor,
    get_air_quality,
    get_weather_carbon_tip,
    get_national_budget,
    get_petroleum_data,
    get_fuel_prices,
)

router = APIRouter()


@router.get("/live")
async def get_live_govt_data(city: str = "Bengaluru", state: str = "Karnataka"):
    grid      = await get_grid_emission_factor(state)
    aqi       = await get_air_quality(city)
    weather   = await get_weather_carbon_tip(city)
    national  = await get_national_budget()
    petroleum = await get_petroleum_data()
    fuel      = await get_fuel_prices(city)
    return {
        "grid":       grid,
        "aqi":        aqi,
        "weather":    weather,
        "national":   national,
        "petroleum":  petroleum,
        "fuel_prices": fuel,
    }
