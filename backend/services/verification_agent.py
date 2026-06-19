"""
AI-powered verification agents for EcoMind.

Contains two agents:
  - ``verify_bill``: checks whether extracted bill data is realistic against
    Indian utility benchmarks.
  - ``verify_action_completion``: assesses whether a user's claim about
    completing a carbon-reduction action is believable.

Both agents use Gemini 1.5 Flash and return structured JSON responses.
"""
import os
import json
import google.generativeai as genai

# Module-level constant — shared with gemini_service for consistency
GEMINI_MODEL_NAME: str = "gemini-1.5-flash"

__all__ = ["verify_bill", "verify_action_completion"]


def _get_genai() -> genai.GenerativeModel:
    """
    Initialise and return a Gemini GenerativeModel instance.

    Reads the API key from the ``GEMINI_API_KEY`` environment variable and
    configures the ``google.generativeai`` library before returning the model.

    Returns:
        genai.GenerativeModel: A ready-to-use Gemini model instance.

    Raises:
        No exceptions — if the key is missing the library may raise later.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
    return genai.GenerativeModel(GEMINI_MODEL_NAME)


def _strip_fences(text: str) -> str:
    """
    Remove markdown code-fence wrappers from a Gemini response string.

    Args:
        text: Raw text that may be wrapped in ```json ... ``` or ``` ... ```.

    Returns:
        str: The trimmed content with fences removed, suitable for
             ``json.loads``.

    Raises:
        No exceptions are raised; the function is purely transformative.
    """
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


# ─── Bill Verification Agent ────────────────────────────────────────────────────
async def verify_bill(bill_data: dict) -> dict:
    """
    Verify whether extracted utility bill data is realistic using Gemini.

    Compares the provided bill fields against Indian utility benchmarks
    (average household electricity usage, LPG cylinder sizes, petrol volumes)
    and returns a structured verdict with a confidence score and optional
    CO₂ correction.

    Args:
        bill_data: Dictionary containing bill fields:
            - ``bill_type`` (str): 'electricity', 'lpg', 'fuel', or 'food'.
            - ``provider`` (str): Utility company name.
            - ``units`` (int|float): Consumption units.
            - ``amount`` (float): Total bill amount in INR.
            - ``period`` (str): Billing period label.
            - ``co2_kg`` (float): Calculated CO₂ in kg.

    Returns:
        dict: {
            "status": "verified" | "suspicious" | "failed",
            "confidence": int (0–100),
            "notes": str (one-sentence explanation),
            "corrected_co2_kg": float
        }

    Raises:
        No exceptions are raised; errors return a safe default response.
    """
    default: dict = {
        "status": "verified",
        "confidence": 70,
        "notes": "Auto-verified (agent unavailable).",
        "corrected_co2_kg": bill_data.get("co2_kg", 0.0)
    }
    try:
        model = _get_genai()
        prompt = f"""You are a bill verification agent for India.
Check if this utility bill data is realistic:
Bill type: {bill_data.get('bill_type')}
Provider: {bill_data.get('provider')}
Units: {bill_data.get('units')}
Amount: {bill_data.get('amount')} INR
Period: {bill_data.get('period')}
CO2 calculated: {bill_data.get('co2_kg')} kg

Indian benchmarks:
- Electricity: avg 200-400 units/month, ₹800-2000 for home
- LPG: 10-15 kg per cylinder, ₹800-900
- Petrol: 30-100 litres/month typical

Reply ONLY with valid JSON (no markdown fences):
{{
  "status": "verified" or "suspicious" or "failed",
  "confidence": 0-100,
  "notes": "one sentence explanation",
  "corrected_co2_kg": corrected value or same value
}}"""
        response = model.generate_content(prompt)
        result = json.loads(_strip_fences(response.text))
        return {
            "status": result.get("status", "verified"),
            "confidence": int(result.get("confidence", 70)),
            "notes": result.get("notes", ""),
            "corrected_co2_kg": float(result.get("corrected_co2_kg", bill_data.get("co2_kg", 0)))
        }
    except Exception as e:
        print(f"Bill verification agent error: {e}")
        return default


# ─── Action Completion Verification Agent ───────────────────────────────────────
async def verify_action_completion(action: dict, user_claim: str) -> dict:
    """
    Assess whether a user's claim about completing a carbon action is believable.

    Uses Gemini to evaluate the plausibility of the user's description against
    the expected action, awarding or withholding the associated CO₂ saving.

    Args:
        action: Dictionary describing the planned action:
            - ``action`` (str): Human-readable action description.
            - ``category`` (str): 'travel', 'food', 'energy', or 'shopping'.
            - ``co2_saving_kg`` (float): Expected CO₂ saving in kg.
        user_claim: The user's natural-language description of how they
            completed the action (max 500 chars, already validated by router).

    Returns:
        dict: {
            "verified": bool,
            "co2_saved_kg": float,
            "message": str (one encouraging sentence)
        }

    Raises:
        No exceptions are raised; errors return a safe default response
        (verified=True, full savings awarded).
    """
    default: dict = {
        "verified": True,
        "co2_saved_kg": action.get("co2_saving_kg", 0.5),
        "message": "Great effort — every small step counts!"
    }
    try:
        model = _get_genai()
        prompt = f"""User claims to have completed this carbon reduction action:
Action: {action.get('action')}
Category: {action.get('category')}
User says: {user_claim}

Is this claim believable? Reply ONLY with valid JSON (no markdown fences):
{{
  "verified": true or false,
  "co2_saved_kg": actual saving as a number,
  "message": "one encouraging sentence"
}}"""
        response = model.generate_content(prompt)
        result = json.loads(_strip_fences(response.text))
        return {
            "verified": bool(result.get("verified", True)),
            "co2_saved_kg": float(result.get("co2_saved_kg", action.get("co2_saving_kg", 0))),
            "message": result.get("message", "")
        }
    except Exception as e:
        print(f"Action verification agent error: {e}")
        return default
