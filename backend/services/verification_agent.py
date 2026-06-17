import os
import json
import google.generativeai as genai

def _get_genai():
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
    return genai.GenerativeModel("gemini-1.5-flash")

def _strip_fences(text: str) -> str:
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
    default = {
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
    default = {
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
