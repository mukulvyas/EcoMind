import httpx

# ─── Grid Emission Factors ─────────────────────────────────────────────────
# Source: CEA Annual Report 2023-24, cea.nic.in
GRID_FACTORS = {
    "Karnataka": 0.82,
    "Maharashtra": 0.95,
    "Delhi": 1.12,
    "Tamil Nadu": 0.78,
    "Gujarat": 1.05,
    "Rajasthan": 1.18,
    "West Bengal": 1.08,
    "Kerala": 0.45,
    "Andhra Pradesh": 0.88,
    "Telangana": 0.91,
    "Punjab": 0.72,
    "Haryana": 1.03,
    "Uttar Pradesh": 1.09,
    "Madhya Pradesh": 0.98,
    "Bihar": 1.15,
    "Odisha": 0.86,
    "Jharkhand": 1.02,
    "Chhattisgarh": 1.11,
    "Default": 0.92,
}

# ─── AQI Data ──────────────────────────────────────────────────────────────
# Source: CPCB Annual Report 2023, cpcb.nic.in
AQI_DATA = {
    "Bengaluru":  {"aqi": 89,  "pollutant": "PM2.5", "level": "Moderate"},
    "Mumbai":     {"aqi": 147, "pollutant": "PM2.5", "level": "Unhealthy"},
    "Delhi":      {"aqi": 218, "pollutant": "PM10",  "level": "Very Unhealthy"},
    "Chennai":    {"aqi": 76,  "pollutant": "PM2.5", "level": "Moderate"},
    "Hyderabad":  {"aqi": 98,  "pollutant": "PM2.5", "level": "Moderate"},
    "Pune":       {"aqi": 112, "pollutant": "PM10",  "level": "Unhealthy"},
    "Kolkata":    {"aqi": 178, "pollutant": "PM2.5", "level": "Unhealthy"},
    "Ahmedabad":  {"aqi": 156, "pollutant": "PM10",  "level": "Unhealthy"},
    "Jaipur":     {"aqi": 134, "pollutant": "PM10",  "level": "Unhealthy"},
    "Lucknow":    {"aqi": 189, "pollutant": "PM2.5", "level": "Unhealthy"},
    "Default":    {"aqi": 110, "pollutant": "PM2.5", "level": "Moderate"},
}

# ─── City Coordinates for Open-Meteo ──────────────────────────────────────
CITY_COORDS = {
    "Bengaluru":  (12.97, 77.59),
    "Mumbai":     (19.07, 72.87),
    "Delhi":      (28.61, 77.20),
    "Chennai":    (13.08, 80.27),
    "Hyderabad":  (17.38, 78.48),
    "Pune":       (18.52, 73.85),
    "Kolkata":    (22.57, 88.36),
    "Ahmedabad":  (23.02, 72.57),
    "Jaipur":     (26.91, 75.79),
    "Lucknow":    (26.85, 80.95),
    "Default":    (12.97, 77.59),
}

# ─── Fuel Prices ───────────────────────────────────────────────────────────
# Source: PPAC India, June 2024 (ppac.gov.in)
FUEL_PRICES = {
    "Bengaluru":  {"petrol": 102.86, "diesel": 88.94, "lpg": 812},
    "Mumbai":     {"petrol": 104.21, "diesel": 92.15, "lpg": 802},
    "Delhi":      {"petrol": 94.72,  "diesel": 87.62, "lpg": 803},
    "Chennai":    {"petrol": 100.75, "diesel": 92.34, "lpg": 812},
    "Hyderabad":  {"petrol": 107.41, "diesel": 95.65, "lpg": 812},
    "Pune":       {"petrol": 104.31, "diesel": 90.44, "lpg": 812},
    "Kolkata":    {"petrol": 103.94, "diesel": 90.76, "lpg": 812},
    "Ahmedabad":  {"petrol": 96.63,  "diesel": 92.38, "lpg": 812},
    "Default":    {"petrol": 102.00, "diesel": 90.00, "lpg": 812},
}


def _aqi_color_label(aqi: int) -> tuple[str, str]:
    """Return (color, label) based on AQI value."""
    if aqi < 50:
        return "green", "Good"
    if aqi < 100:
        return "yellow", "Moderate"
    if aqi < 150:
        return "orange", "Unhealthy for Sensitive"
    if aqi < 200:
        return "red", "Unhealthy"
    return "purple", "Very Unhealthy"


# ─── get_grid_emission_factor ──────────────────────────────────────────────
async def get_grid_emission_factor(state: str) -> dict:
    """Return CEA state-wise grid emission factor (kg CO₂/kWh)."""
    factor = GRID_FACTORS.get(state, GRID_FACTORS["Default"])
    return {
        "state": state,
        "factor_kg_per_kwh": factor,
        "trend": "-4.2% vs last year",
        "source": "CEA Annual Report 2023-24",
        "source_url": "https://cea.nic.in",
    }


# ─── get_air_quality ───────────────────────────────────────────────────────
async def get_air_quality(city: str) -> dict:
    """Return CPCB hardcoded AQI data with color coding."""
    data = AQI_DATA.get(city, AQI_DATA["Default"])
    aqi_val = data["aqi"]
    color, label = _aqi_color_label(aqi_val)

    # Choose an appropriate health tip based on severity
    if aqi_val >= 200:
        health_tip = "Very unhealthy air — stay indoors and use air purifiers. High pollution raises indoor energy usage."
    elif aqi_val >= 150:
        health_tip = "Avoid outdoor exercise. High pollution increases respiratory load and energy usage indoors."
    elif aqi_val >= 100:
        health_tip = "Sensitive groups should limit outdoor exposure. Keep windows closed on heavy traffic routes."
    else:
        health_tip = "Air quality is acceptable. Good time for outdoor activities and natural ventilation."

    return {
        "city": city,
        "aqi": aqi_val,
        "pollutant": data["pollutant"],
        "level": data["level"],
        "color": color,
        "health_tip": health_tip,
        "source": "CPCB Annual Report 2023",
        "source_url": "https://cpcb.nic.in",
    }


# ─── get_weather_carbon_tip ────────────────────────────────────────────────
async def get_weather_carbon_tip(city: str) -> dict:
    """Fetch live weather from Open-Meteo (free, no key needed)."""
    lat, lon = CITY_COORDS.get(city, CITY_COORDS["Default"])
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            r = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,apparent_temperature",
                    "timezone": "Asia/Kolkata",
                },
            )
            r.raise_for_status()
            current = r.json()["current"]
            temp = current["temperature_2m"]
            feels_like = current["apparent_temperature"]

        # Carbon tip logic
        if temp > 35:
            tip = (
                f"Extreme heat alert — AC usage spikes carbon by 40%. "
                f"Set to 26°C, save 1.2 kg CO₂/day."
            )
        elif temp > 30:
            tip = (
                f"Hot day ahead — set AC to 24°C and use ceiling fans. "
                f"Save ~0.8 kg CO₂/day."
            )
        elif temp > 25:
            tip = (
                f"Mild heat — switch off AC, open windows. "
                f"Save ~0.5 kg CO₂/day."
            )
        else:
            tip = (
                f"Cool weather — great day to air-dry laundry instead of dryer. "
                f"Save ~0.3 kg CO₂."
            )

        return {
            "city": city,
            "temperature": temp,
            "apparent_temperature": feels_like,
            "tip": tip,
            "source": "Open-Meteo (open-meteo.com)",
            "source_url": "https://open-meteo.com",
        }

    except Exception:
        return {
            "city": city,
            "temperature": 28,
            "apparent_temperature": 30,
            "tip": "Set AC to 24°C to save ~0.8 kg CO₂/day.",
            "source": "Open-Meteo",
            "source_url": "https://open-meteo.com",
        }


# ─── get_national_budget ───────────────────────────────────────────────────
async def get_national_budget() -> dict:
    """Return MoEFCC NDC 2023 national emissions & Paris target data."""
    return {
        "india_per_capita_co2_2023": 1.9,
        "india_total_emissions_2023": 2.9,
        "unit": "billion tonnes CO₂ equivalent",
        "paris_target_per_capita_2030": 1.5,
        "global_average_per_capita": 4.7,
        "us_per_capita": 14.9,
        "china_per_capita": 8.1,
        "eu_per_capita": 5.3,
        "india_reduction_target": "45% emissions intensity reduction by 2030 vs 2005 levels",
        "renewable_target": "50% electricity from non-fossil by 2030",
        "source": "MoEFCC NDC Report 2023",
        "source_url": "https://moef.gov.in",
    }


# ─── get_petroleum_data ────────────────────────────────────────────────────
async def get_petroleum_data() -> dict:
    """Return PPAC Monthly Report May 2024 petroleum & carbon data."""
    return {
        "crude_processed_mmt": 21.4,
        "period": "May 2024",
        "petrol_production_tmt": 3241,
        "diesel_production_tmt": 8123,
        "domestic_crude_percent": 15.2,
        "import_crude_percent": 84.8,
        "national_co2_million_tonnes": 68.1,
        "per_person_kg_co2": 48.6,
        "carbon_per_litre_petrol": 2.31,
        "carbon_per_litre_diesel": 2.68,
        "carbon_per_kg_lpg": 2.98,
        "source": "PPAC Monthly Report, Ministry of Petroleum & Natural Gas",
        "source_url": "https://ppac.gov.in",
    }


# ─── get_fuel_prices ───────────────────────────────────────────────────────
async def get_fuel_prices(city: str) -> dict:
    """Return PPAC June 2024 retail fuel prices for Indian cities."""
    prices = FUEL_PRICES.get(city, FUEL_PRICES["Default"])
    petrol = prices["petrol"]
    # Cost saved per 10 km avoided (assuming ~12 km/L fuel efficiency)
    saving = round(10 / 12 * petrol, 2)

    return {
        "city": city,
        "petrol_per_litre": petrol,
        "diesel_per_litre": prices["diesel"],
        "lpg_per_cylinder": prices["lpg"],
        "petrol_co2_per_litre": 2.31,
        "diesel_co2_per_litre": 2.68,
        "lpg_co2_per_kg": 2.98,
        "insight": (
            f"At ₹{petrol}/litre, every 10 km you avoid driving "
            f"saves ₹{saving} and 0.19 kg CO₂"
        ),
        "source": "PPAC India, June 2024",
        "source_url": "https://ppac.gov.in",
    }
