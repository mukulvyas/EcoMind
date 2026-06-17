import pytest
from services.govt_service import (
    get_grid_emission_factor,
    get_air_quality,
    get_national_budget,
    get_fuel_prices
)
import asyncio

def test_karnataka_grid_factor():
    result = asyncio.run(get_grid_emission_factor("Karnataka"))
    assert result["factor_kg_per_kwh"] == 0.82
    assert result["source"] == "CEA Annual Report 2023-24"

def test_unknown_state_uses_default():
    result = asyncio.run(
        get_grid_emission_factor("UnknownState")
    )
    assert result["factor_kg_per_kwh"] == 0.92

def test_bengaluru_aqi():
    result = asyncio.run(get_air_quality("Bengaluru"))
    assert result["aqi"] == 89
    assert result["city"] == "Bengaluru"
    assert "color" in result

def test_national_budget_has_required_fields():
    result = asyncio.run(get_national_budget())
    assert result["india_per_capita_co2_2023"] == 1.9
    assert result["paris_target_per_capita_2030"] == 1.5
    assert result["global_average_per_capita"] == 4.7

def test_fuel_prices_bengaluru():
    result = asyncio.run(get_fuel_prices("Bengaluru"))
    assert result["petrol_per_litre"] == 102.86
    assert result["petrol_co2_per_litre"] == 2.31

def test_unknown_city_uses_default():
    result = asyncio.run(get_fuel_prices("UnknownCity"))
    assert result["petrol_per_litre"] == 102.00
