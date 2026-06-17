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
        print("Firestore connected using FIREBASE_SERVICE_ACCOUNT_KEY.")
    else:
        # Fallback to Application Default Credentials (e.g. for GCP environments)
        db = firestore.AsyncClient(project="ecomind-499612")
        print("Firestore connected using Application Default Credentials for project ecomind-499612.")
except Exception as e:
    print(f"Warning: Firestore init failed: {e}. Running in offline mode.")
    db = None

def _ts() -> str:
    """
    A brief description of _ts.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
    """
    return datetime.utcnow().isoformat()

# ─── FOOTPRINTS ────────────────────────────────────────────────────────────────
async def save_footprint(session_id: str, data: dict):
    """
    A brief description of save_footprint.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
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
    A brief description of get_footprint_history.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
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
    A brief description of get_latest_footprint.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
    """
    history = await get_footprint_history(session_id)
    if history:
        return history[0]
    return {"total_co2": 2.4, "travel": 0.9, "food": 0.7, "energy": 0.5, "shopping": 0.3}

# ─── BILLS ─────────────────────────────────────────────────────────────────────
async def save_bill(session_id: str, bill_data: dict) -> str:
    """
    A brief description of save_bill.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
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
    A brief description of get_all_bills.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
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
    A brief description of update_bill_status.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
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
    A brief description of save_action_plan.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
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
    A brief description of get_latest_action_plan.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
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
    A brief description of update_action_item.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
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
    A brief description of save_chat_message.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
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
    A brief description of get_chat_history.
    Args:
        ...
    Returns:
        ...
    Raises:
        ...
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
