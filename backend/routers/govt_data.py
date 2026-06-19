"""
Government data router for EcoMind.

Aggregates live and reference data from multiple Indian government sources
into a single endpoint for the frontend dashboard.
"""
from fastapi import APIRouter
from datetime import datetime, timezone
from services.govt_service import (
    get_grid_emission_factor,
    get_air_quality,
    get_weather_carbon_tip,
    get_national_budget,
    get_petroleum_data,
    get_fuel_prices,
)

router = APIRouter()

# Data freshness metadata — reflects the latest data sources used
_DATA_AS_OF = "2024-06-01"


@router.get("/live")
async def get_live_govt_data(city: str = "Bengaluru", state: str = "Karnataka") -> dict:
    """
    Aggregate government and environmental data for the given city and state.

    Combines grid emission factors, AQI, live weather, national NDC budget,
    petroleum data, and retail fuel prices into a single response. All
    static data includes source citations for full traceability.

    Args:
        city:  Indian city name for AQI, weather, and fuel price lookup
               (default: "Bengaluru").
        state: Indian state name for grid emission factor lookup
               (default: "Karnataka").

    Returns:
        dict: {
            "grid":       dict — CEA state grid emission factor,
            "aqi":        dict — CPCB city air quality index,
            "weather":    dict — Open-Meteo live temperature + carbon tip,
            "national":   dict — MoEFCC NDC national emissions,
            "petroleum":  dict — PPAC monthly petroleum data,
            "fuel_prices": dict — PPAC city retail fuel prices,
            "meta": {
                "last_updated": ISO timestamp of this response,
                "data_as_of":   date string of the underlying data vintage,
            }
        }
    """
    grid      = await get_grid_emission_factor(state)
    aqi       = await get_air_quality(city)
    weather   = await get_weather_carbon_tip(city)
    national  = await get_national_budget()
    petroleum = await get_petroleum_data()
    fuel      = await get_fuel_prices(city)
    return {
        "grid":        grid,
        "aqi":         aqi,
        "weather":     weather,
        "national":    national,
        "petroleum":   petroleum,
        "fuel_prices": fuel,
        "meta": {
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "data_as_of":   _DATA_AS_OF,
        },
    }
