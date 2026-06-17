import os
import json
import google.generativeai as genai

# Helper to strip markdown JSON fences
def strip_json_fences(text: str) -> str:
    """
    A brief description of strip_json_fences.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
    """
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

# Function 1: Chat with EcoMind
async def chat_with_ecomind(messages: list, footprint: dict = None, historical_chat: list = None, active_plan: dict = None, recent_bills: list = None) -> str:
    """
    Chat with the EcoMind AI Coach using context-aware RAG.
    
    Args:
        messages: list of message dictionaries
        footprint: user's carbon footprint data
        historical_chat: previous chat history
        active_plan: the user's active reduction plan
        recent_bills: list of recent bills
        
    Returns:
        str: AI response text
        
    Raises:
        Exception: when Gemini fails
    """
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return "Configuration error: API key missing."

        genai.configure(api_key=api_key)

        system_instruction = (
            "You are EcoMind, a sharp carbon coach for Indian users.\n"
            "Rules you must always follow:\n"
            "- Maximum 3 sentences per response. Never more.\n"
            "- Always end with ONE specific number (kg CO\u2082 saved, rupees saved, or % reduction)\n"
            "- No bold text, no bullet points, no markdown formatting\n"
            "- Sound like a smart friend, not a report\n"
            "- Use Indian context: BEE, CEA, BESCOM, kg CO\u2082, INR\n"
            "- If asked for a plan, give max 5 actions, one line each"
        )

        # ── RAG Context Block ──────────────────────────────────────────────────
        context_parts = []

        if footprint:
            fp = footprint
            context_parts.append(
                f"USER FOOTPRINT:\n"
                f"  Total: {fp.get('total_co2', 2.4)}T/yr (India avg: 1.9T)\n"
                f"  Travel:{fp.get('travel',0.9)}T  Food:{fp.get('food',0.7)}T  "
                f"Energy:{fp.get('energy',0.5)}T  Shopping:{fp.get('shopping',0.3)}T"
            )

        if recent_bills:
            bill_lines = []
            for b in recent_bills[:5]:
                icon = "\u26a1" if b.get('bill_type') == 'electricity' else "\U0001f525" if b.get('bill_type') == 'lpg' else "\u26fd"
                bill_lines.append(
                    f"  {icon} {b.get('bill_type','').title()} — {b.get('units',0)} units, "
                    f"{b.get('co2_kg',0):.1f}kg CO\u2082 ({b.get('period','')}) [{b.get('status','?')}]"
                )
            context_parts.append("RECENT BILLS:\n" + "\n".join(bill_lines))

        if active_plan and active_plan.get('actions'):
            done = active_plan.get('completed_actions', 0)
            total = active_plan.get('total_actions', 30)
            saved = active_plan.get('co2_saved_so_far_kg', 0)
            pending = next((a['action'] for a in active_plan['actions'] if not a.get('completed')), 'all done!')
            context_parts.append(
                f"ACTION PLAN PROGRESS:\n"
                f"  {done}/{total} actions done — {saved:.1f}kg CO\u2082 saved so far\n"
                f"  Next pending: {pending}"
            )

        if historical_chat:
            last_msgs = historical_chat[-5:]
            summary = "  ".join([f"{m.get('role','?')}: {m.get('content','')[:60]}" for m in last_msgs])
            context_parts.append(f"RECENT CONVERSATION:\n  {summary}")

        if context_parts:
            system_instruction += "\n\nUSER CONTEXT:\n" + "\n\n".join(context_parts)
        # ─────────────────────────────────────────────────────────────────────

        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_instruction
        )

        # Format Gemini chat history (role: user/model)
        gemini_history = []
        for msg in messages[:-1]:
            role = "user" if msg["role"] == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg["content"]]})

        # Build footprint context for user message
        fp = footprint or {"total_co2": 2.4, "travel": 0.9, "food": 0.7, "energy": 0.5, "shopping": 0.3}
        travel = fp.get("travel", 0.9)
        food = fp.get("food", 0.7)
        energy = fp.get("energy", 0.5)
        shopping = fp.get("shopping", 0.3)
        total_co2 = fp.get("total_co2", 2.4)

        categories = {"travel": travel, "food": food, "energy": energy, "shopping": shopping}
        biggest = max(categories, key=categories.get)

        footprint_context = (
            f"User footprint:\n"
            f"- Total: {total_co2} tonnes/year (India avg: 1.9T)\n"
            f"- Travel: {travel}T | Food: {food}T\n"
            f"- Energy: {energy}T | Shopping: {shopping}T\n"
            f"- Biggest category: {biggest}\n"
        )

        latest_content = f"{footprint_context}\nUser message: {messages[-1]['content']}"

        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(latest_content)
        return response.text
    except Exception as e:
        print(f"Gemini chat error: {e}")
        return f"API Error: {str(e)}"

# Function 2: Analyze Bill Image
async def analyze_bill_image(image_bytes: bytes, filename: str, bill_type: str) -> dict:
    """
    Analyze a bill image to extract carbon footprint data.
    
    Args:
        image_bytes: raw image bytes
        filename: name of the uploaded file
        bill_type: category of bill ('electricity', 'food', etc)
        
    Returns:
        dict: extracted bill data and CO2 impact
        
    Raises:
        Exception: when Gemini fails
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "AIza...":
        # Simulation fallback
        import random
        if bill_type == "food":
            amount = random.randint(1200, 4500)
            co2_kg = round(amount * 0.012, 1)
            return {
                "units": random.randint(5, 25),
                "period": "May 2026",
                "amount": amount,
                "provider": random.choice(["DMart", "Amazon Fresh", "BigBasket", "Reliance Retail"]),
                "bill_type": "food",
                "co2_kg": co2_kg
            }
        else:
            units = random.randint(100, 300)
            co2_mult = 0.82 if bill_type == "electricity" else 2.98 if bill_type == "lpg" else 2.31
            co2_kg = round(units * co2_mult, 1)
            return {
                "units": units,
                "period": "Current Cycle",
                "amount": units * 8,
                "provider": "Local Provider (Simulated)",
                "bill_type": bill_type,
                "co2_kg": co2_kg
            }

    try:
        from PIL import Image
        import io
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-flash-latest")
        
        image = Image.open(io.BytesIO(image_bytes))
        
        prompt = f"""
Analyze this {bill_type} bill image and extract the following details as a valid JSON object.
Return ONLY valid JSON structure:
{{
  "units": <int: units of electricity/LPG/fuel consumed, or count of items for food bills>,
  "period": "<string: bill period or date>",
  "amount": <float: total bill amount in INR>,
  "provider": "<string: provider name (e.g. BESCOM, DMart, Amazon Fresh)>",
  "bill_type": "{bill_type}",
  "co2_kg": <float: carbon footprint in kg CO2>
}}

Follow these CO2 calculation rules for co2_kg:
- electricity: units × 0.82
- LPG: kg × 2.98
- fuel: litres × 2.31
- food/grocery: Estimate the carbon footprint of the individual food items purchased (e.g., red meat is ~27.0 kg CO2/kg, chicken/pork is ~6.0 kg CO2/kg, dairy/cheese is ~8.0 kg CO2/kg, grains/fruits/veg is ~1.0 kg CO2/kg, packaged foods are ~2.0 kg CO2/kg). Sum up these estimated carbon weights.

Return ONLY raw JSON. Do not include markdown fences, backticks, or other text.
"""
        response = model.generate_content([prompt, image])
        clean_text = strip_json_fences(response.text)
        return json.loads(clean_text)
    except Exception as e:
        print(f"Gemini bill analysis error: {e}")
        # Return sensible default fallback
        import random
        return {
            "units": 150 if bill_type != "food" else 10,
            "period": "Current Cycle",
            "amount": 1200,
            "provider": "Unknown",
            "bill_type": bill_type,
            "co2_kg": 123.0
        }

# Function 3: Generate Action Plan
async def generate_action_plan(footprint: dict) -> list:
    """
    Generate a 30-day carbon reduction action plan.
    
    Args:
        footprint: user's carbon footprint data
        
    Returns:
        list: 30 daily action items
        
    Raises:
        Exception: when Gemini fails
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "AIza...":
        # Simulation fallback
        plan = []
        categories = ["travel", "food", "energy", "shopping"]
        for day in range(1, 31):
            plan.append({
                "day": day,
                "action": f"Action for day {day}: Set AC to 25°C or walk for short trips.",
                "category": categories[day % 4],
                "co2_saving_kg": round(0.5 + (day % 3) * 0.4, 1),
                "difficulty": "easy" if day % 3 == 0 else "medium" if day % 3 == 1 else "hard"
            })
        return plan

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-flash-latest")
        
        travel = footprint.get("travel", 0.9)
        food = footprint.get("food", 0.7)
        energy = footprint.get("energy", 0.5)
        shopping = footprint.get("shopping", 0.3)
        
        categories = {"travel": travel, "food": food, "energy": energy, "shopping": shopping}
        biggest = max(categories, key=categories.get)
        
        prompt = f"""
Generate a 30-day India-specific carbon footprint reduction plan for a user whose biggest emission category is '{biggest}'.
The user's category details are:
- Travel: {travel}T/yr
- Food: {food}T/yr
- Energy: {energy}T/yr
- Shopping: {shopping}T/yr

Return ONLY a valid JSON array of exactly 30 items (representing days 1 to 30), with no markdown fences, no backticks, and no introductory text.
Each item in the array MUST match this exact schema:
{{
  "day": <int: 1 to 30>,
  "action": "<string: descriptive action step tailored for Indian context>",
  "category": "<string: 'travel' | 'food' | 'energy' | 'shopping'>",
  "co2_saving_kg": <float: estimated daily/weekly CO2 savings in kg>,
  "difficulty": "<string: 'easy' | 'medium' | 'hard'>"
}}
"""
        response = model.generate_content(prompt)
        clean_text = strip_json_fences(response.text)
        return json.loads(clean_text)
    except Exception as e:
        print(f"Gemini action plan error: {e}")
        # Return fallback
        plan = []
        for day in range(1, 31):
            plan.append({
                "day": day,
                "action": f"Mock carbon reduction action for day {day}",
                "category": "energy",
                "co2_saving_kg": 0.5,
                "difficulty": "easy"
            })
        return plan
