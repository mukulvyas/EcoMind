import os
from datetime import datetime
from google.cloud import firestore

# Initialize Firestore client
# Cloud Run automatically injects credentials.
try:
    db = firestore.AsyncClient()
except Exception as e:
    print(f"Warning: Failed to initialize Firestore AsyncClient. {e}")
    db = None

async def save_footprint(data: dict):
    if not db: return
    session_id = data.get("session_id")
    if not session_id:
        return
    
    try:
        doc_ref = db.collection('users').document(session_id).collection('footprints').document()
        if "timestamp" not in data:
            data["timestamp"] = datetime.utcnow().isoformat()
            
        await doc_ref.set(data)
    except Exception as e:
        print(f"Firestore error save_footprint: {e}")

async def get_latest_footprint(session_id: str) -> dict:
    if not db:
        return {
            "total_co2": 2.4, "travel": 0.9,
            "food": 0.7, "energy": 0.5, "shopping": 0.3
        }
    try:
        docs = db.collection('users').document(session_id).collection('footprints')\
                 .order_by('timestamp', direction=firestore.Query.DESCENDING).limit(1).stream()
        
        async for doc in docs:
            return doc.to_dict()
            
    except Exception as e:
        print(f"Firestore error get_latest_footprint: {e}")
        
    return {
        "total_co2": 2.4, "travel": 0.9,
        "food": 0.7, "energy": 0.5, "shopping": 0.3
    }

async def get_footprint_history(session_id: str) -> list:
    if not db: return []
    try:
        docs = db.collection('users').document(session_id).collection('footprints')\
                 .order_by('timestamp', direction=firestore.Query.DESCENDING).limit(8).stream()
        
        results = []
        async for doc in docs:
            results.append(doc.to_dict())
        return results
    except Exception as e:
        print(f"Firestore error get_footprint_history: {e}")
        return []

async def save_bill(session_id: str, bill_data: dict):
    if not db or not session_id: return
    try:
        doc_ref = db.collection('users').document(session_id).collection('bills').document()
        entry = {
            **bill_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await doc_ref.set(entry)
    except Exception as e:
        print(f"Firestore error save_bill: {e}")

async def save_action_plan(session_id: str, plan_text: str):
    if not db or not session_id: return
    try:
        doc_ref = db.collection('users').document(session_id).collection('action_plans').document()
        entry = {
            "plan_text": plan_text,
            "timestamp": datetime.utcnow().isoformat()
        }
        await doc_ref.set(entry)
    except Exception as e:
        print(f"Firestore error save_action_plan: {e}")

async def get_latest_action_plan(session_id: str) -> str:
    if not db: return ""
    try:
        docs = db.collection('users').document(session_id).collection('action_plans')\
                 .order_by('timestamp', direction=firestore.Query.DESCENDING).limit(1).stream()
        
        async for doc in docs:
            return doc.to_dict().get("plan_text", "")
    except Exception as e:
        print(f"Firestore error get_latest_action_plan: {e}")
    return ""

async def save_chat_message(session_id: str, role: str, content: str):
    if not db or not session_id: return
    try:
        doc_ref = db.collection('users').document(session_id).collection('chat_history').document()
        entry = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        }
        await doc_ref.set(entry)
    except Exception as e:
        print(f"Firestore error save_chat_message: {e}")

async def get_chat_history(session_id: str, limit: int = 10) -> list:
    if not db: return []
    try:
        docs = db.collection('users').document(session_id).collection('chat_history')\
                 .order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit).stream()
        
        results = []
        async for doc in docs:
            results.append(doc.to_dict())
        return list(reversed(results))
    except Exception as e:
        print(f"Firestore error get_chat_history: {e}")
        return []
