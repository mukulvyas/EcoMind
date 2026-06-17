import os
import uuid
from datetime import datetime
from google.cloud import firestore

import json
from google.oauth2 import service_account

# ─── Firestore client init ─────────────────────────────────────────────────────
try:
    service_account_info_str = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
    if service_account_info_str:
        # Load from JSON string in environment variable
        creds_dict = json.loads(service_account_info_str)
        credentials = service_account.Credentials.from_service_account_info(creds_dict)
        db = firestore.AsyncClient(project=creds_dict.get("project_id"), credentials=credentials)
        print("[Firestore] ✅ Connected using FIREBASE_SERVICE_ACCOUNT_KEY env var.")
    else:
        # Fallback to Application Default Credentials (works when Cloud Run SA has Firestore IAM)
        print("[Firestore] ⚠️  FIREBASE_SERVICE_ACCOUNT_KEY not set — falling back to ADC.")
        print("[Firestore]    Ensure Cloud Run SA has roles/datastore.user on project ecomind-499612.")
        db = firestore.AsyncClient(project="ecomind-499612")
        print("[Firestore] ✅ Connected using Application Default Credentials.")
except Exception as e:
    print(f"[Firestore] ❌ Init failed: {e}")
    print("[Firestore]    Set FIREBASE_SERVICE_ACCOUNT_KEY env var on Cloud Run to fix this.")
    db = None

def _ts() -> str:
    """Return the current UTC timestamp as an ISO 8601 string."""
    return datetime.utcnow().isoformat()

# ─── FOOTPRINTS ────────────────────────────────────────────────────────────────
async def save_footprint(session_id: str, data: dict):
    """
    Persist a calculated carbon footprint entry to Firestore.

    Args:
        session_id: UUID of the user session (used as document path).
        data: Dict containing total_co2, travel, food, energy, shopping, timestamp.

    Returns:
        None. Silently skips if Firestore is unavailable.

    Raises:
        Exception: Caught internally; error is logged but not re-raised.
    """
    if not db: return
    try:
        doc_ref = db.collection("sessions").document(session_id)\
                    .collection("footprints").document()
        payload = {**data, "created_at": _ts(), "source": "calculator"}
        await doc_ref.set(payload)
    except Exception as e:
        print(f"Firestore save_footprint error: {e}")

async def get_footprint_history(session_id: str) -> list:
    """
    Retrieve the most recent footprint entries for a session.

    Args:
        session_id: UUID of the user session.

    Returns:
        list: Up to 8 footprint dicts ordered newest-first. Empty list if unavailable.

    Raises:
        Exception: Caught internally; error is logged and empty list returned.
    """
    if not db: return []
    try:
        docs = db.collection("sessions").document(session_id)\
                 .collection("footprints")\
                 .order_by("created_at", direction=firestore.Query.DESCENDING)\
                 .limit(8).stream()
        return [doc.to_dict() async for doc in docs]
    except Exception as e:
        print(f"Firestore get_footprint_history error: {e}")
        return []

async def get_latest_footprint(session_id: str) -> dict:
    """
    Get the single most recent footprint for a session.

    Args:
        session_id: UUID of the user session.

    Returns:
        dict: The most recent footprint, or a safe default if none exists.

    Raises:
        Exception: Caught internally via get_footprint_history.
    """
    history = await get_footprint_history(session_id)
    if history:
        return history[0]
    return {"total_co2": 2.4, "travel": 0.9, "food": 0.7, "energy": 0.5, "shopping": 0.3}

# ─── BILLS ─────────────────────────────────────────────────────────────────────
async def save_bill(session_id: str, bill_data: dict) -> str:
    """
    Save an uploaded utility bill to Firestore with status 'pending'.

    Args:
        session_id: UUID of the user session.
        bill_data: Dict containing bill_type, filename, units, period, amount,
                   provider, co2_kg.

    Returns:
        str: The generated bill_id (UUID). Returned even if Firestore is unavailable.

    Raises:
        Exception: Caught internally; error is logged but bill_id is still returned.
    """
    bill_id = str(uuid.uuid4())
    if not db: return bill_id
    try:
        doc_ref = db.collection("sessions").document(session_id)\
                    .collection("bills").document(bill_id)
        payload = {
            "bill_id": bill_id,
            "bill_type": bill_data.get("bill_type", ""),
            "filename": bill_data.get("filename", ""),
            "units": bill_data.get("units", 0),
            "period": bill_data.get("period", ""),
            "amount": bill_data.get("amount", 0),
            "provider": bill_data.get("provider", ""),
            "co2_kg": bill_data.get("co2_kg", 0.0),
            "status": "pending",
            "verified_by": None,
            "verified_at": None,
            "verification_notes": "",
            "created_at": _ts()
        }
        await doc_ref.set(payload)
    except Exception as e:
        print(f"Firestore save_bill error: {e}")
    return bill_id

async def get_all_bills(session_id: str) -> list:
    """
    Retrieve all bills for a session, ordered newest-first.

    Args:
        session_id: UUID of the user session.

    Returns:
        list: All bill dicts for the session. Empty list if unavailable.

    Raises:
        Exception: Caught internally; error is logged and empty list returned.
    """
    if not db: return []
    try:
        docs = db.collection("sessions").document(session_id)\
                 .collection("bills")\
                 .order_by("created_at", direction=firestore.Query.DESCENDING)\
                 .stream()
        return [doc.to_dict() async for doc in docs]
    except Exception as e:
        print(f"Firestore get_all_bills error: {e}")
        return []

async def update_bill_status(session_id: str, bill_id: str, status: str, notes: str, corrected_co2: float = None):
    """
    Update the verification status of a saved bill.

    Args:
        session_id: UUID of the user session.
        bill_id: UUID of the specific bill document.
        status: New status string — 'verified', 'suspicious', or 'failed'.
        notes: Human-readable verification notes.
        corrected_co2: Corrected CO₂ value in kg, or None to keep existing.

    Returns:
        None. Silently skips if Firestore is unavailable.

    Raises:
        Exception: Caught internally; error is logged but not re-raised.
    """
    if not db: return
    try:
        doc_ref = db.collection("sessions").document(session_id)\
                    .collection("bills").document(bill_id)
        update = {
            "status": status,
            "verification_notes": notes,
            "verified_by": "gemini-agent",
            "verified_at": _ts()
        }
        if corrected_co2 is not None:
            update["co2_kg"] = corrected_co2
        await doc_ref.update(update)
    except Exception as e:
        print(f"Firestore update_bill_status error: {e}")

# ─── ACTION PLANS ───────────────────────────────────────────────────────────────
async def save_action_plan(session_id: str, actions: list) -> str:
    """
    Persist a newly generated 30-day action plan to Firestore.

    Args:
        session_id: UUID of the user session.
        actions: List of action dicts, each with day, action, category,
                 co2_saving_kg, difficulty.

    Returns:
        str: The generated plan_id (UUID).

    Raises:
        Exception: Caught internally; error is logged but plan_id is still returned.
    """
    plan_id = str(uuid.uuid4())
    if not db: return plan_id
    try:
        doc_ref = db.collection("sessions").document(session_id)\
                    .collection("action_plans").document(plan_id)
        total_co2 = sum(a.get("co2_saving_kg", 0) for a in actions)
        enriched = [{
            **a,
            "completed": False,
            "completed_at": None
        } for a in actions]
        payload = {
            "plan_id": plan_id,
            "created_at": _ts(),
            "total_actions": len(enriched),
            "completed_actions": 0,
            "total_co2_saving_kg": round(total_co2, 2),
            "co2_saved_so_far_kg": 0.0,
            "actions": enriched
        }
        await doc_ref.set(payload)
    except Exception as e:
        print(f"Firestore save_action_plan error: {e}")
    return plan_id

async def get_latest_action_plan(session_id: str) -> dict:
    """
    Fetch the most recently created action plan for a session.

    Args:
        session_id: UUID of the user session.

    Returns:
        dict: The latest action plan, or empty dict if none exists.

    Raises:
        Exception: Caught internally; error is logged and empty dict returned.
    """
    if not db: return {}
    try:
        docs = db.collection("sessions").document(session_id)\
                 .collection("action_plans")\
                 .order_by("created_at", direction=firestore.Query.DESCENDING)\
                 .limit(1).stream()
        async for doc in docs:
            return doc.to_dict()
    except Exception as e:
        print(f"Firestore get_latest_action_plan error: {e}")
    return {}

async def update_action_item(session_id: str, plan_id: str, day: int, completed: bool, co2_saved: float = 0):
    """
    Mark a single day's action as completed or uncompleted and recalculate totals.

    Args:
        session_id: UUID of the user session.
        plan_id: UUID of the action plan document.
        day: The day number (1–30) to update.
        completed: True to mark complete, False to unmark.
        co2_saved: CO₂ saved in kg for this action (used for recalculation).

    Returns:
        None. Silently skips if Firestore is unavailable or plan not found.

    Raises:
        Exception: Caught internally; error is logged but not re-raised.
    """
    if not db: return
    try:
        doc_ref = db.collection("sessions").document(session_id)\
                    .collection("action_plans").document(plan_id)
        doc = await doc_ref.get()
        if not doc.exists:
            return
        data = doc.to_dict()
        actions = data.get("actions", [])
        for a in actions:
            if a.get("day") == day:
                a["completed"] = completed
                a["completed_at"] = _ts() if completed else None
                break
        completed_count = sum(1 for a in actions if a.get("completed"))
        co2_saved_total = sum(
            a.get("co2_saving_kg", 0) for a in actions if a.get("completed")
        )
        await doc_ref.update({
            "actions": actions,
            "completed_actions": completed_count,
            "co2_saved_so_far_kg": round(co2_saved_total, 2)
        })
    except Exception as e:
        print(f"Firestore update_action_item error: {e}")

# ─── CHAT HISTORY ───────────────────────────────────────────────────────────────
async def save_chat_message(session_id: str, role: str, content: str):
    """
    Append a single chat message to the session's chat history in Firestore.

    Args:
        session_id: UUID of the user session.
        role: Speaker role — 'user' or 'assistant'.
        content: The text content of the message.

    Returns:
        None. Silently skips if Firestore is unavailable.

    Raises:
        Exception: Caught internally; error is logged but not re-raised.
    """
    if not db: return
    try:
        doc_ref = db.collection("sessions").document(session_id)\
                    .collection("chat_history").document()
        await doc_ref.set({"role": role, "content": content, "created_at": _ts()})
    except Exception as e:
        print(f"Firestore save_chat_message error: {e}")

async def get_chat_history(session_id: str, limit: int = 20) -> list:
    """
    Retrieve the most recent chat messages for a session, in chronological order.

    Args:
        session_id: UUID of the user session.
        limit: Maximum number of messages to return (default 20).

    Returns:
        list: Chat message dicts with role, content, created_at — oldest first.
              Empty list if Firestore is unavailable.

    Raises:
        Exception: Caught internally; error is logged and empty list returned.
    """
    if not db: return []
    try:
        docs = db.collection("sessions").document(session_id)\
                 .collection("chat_history")\
                 .order_by("created_at", direction=firestore.Query.DESCENDING)\
                 .limit(limit).stream()
        results = [doc.to_dict() async for doc in docs]
        return list(reversed(results))
    except Exception as e:
        print(f"Firestore get_chat_history error: {e}")
        return []
