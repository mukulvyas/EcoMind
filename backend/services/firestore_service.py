import os
import json
from datetime import datetime

# Local directory setup
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(DATA_DIR, exist_ok=True)

FOOTPRINTS_FILE = os.path.join(DATA_DIR, "footprints.json")
BILLS_FILE = os.path.join(DATA_DIR, "bills.json")

def read_json_file(filepath: str) -> dict:
    if not os.path.exists(filepath):
        return {}
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return {}

def write_json_file(filepath: str, data: dict):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error writing {filepath}: {e}")

async def save_footprint(data: dict):
    session_id = data.get("session_id")
    if not session_id:
        return
    
    footprints = read_json_file(FOOTPRINTS_FILE)
    if session_id not in footprints:
        footprints[session_id] = []
    
    footprints[session_id].append(data)
    write_json_file(FOOTPRINTS_FILE, footprints)

async def get_latest_footprint(session_id: str) -> dict:
    footprints = read_json_file(FOOTPRINTS_FILE)
    local_entries = footprints.get(session_id, [])
    if local_entries:
        sorted_entries = sorted(local_entries, key=lambda x: x.get("timestamp", ""), reverse=True)
        return sorted_entries[0]

    return {
        "total_co2": 2.4, "travel": 0.9,
        "food": 0.7, "energy": 0.5, "shopping": 0.3
    }

async def get_footprint_history(session_id: str) -> list:
    footprints = read_json_file(FOOTPRINTS_FILE)
    local_entries = footprints.get(session_id, [])
    sorted_entries = sorted(local_entries, key=lambda x: x.get("timestamp", ""), reverse=True)
    return sorted_entries[:8]

async def save_bill(session_id: str, bill_data: dict):
    if not session_id:
        return
    
    bills = read_json_file(BILLS_FILE)
    if session_id not in bills:
        bills[session_id] = []
    
    # Store with a timestamp
    entry = {
        **bill_data,
        "timestamp": datetime.utcnow().isoformat()
    }
    bills[session_id].append(entry)
    write_json_file(BILLS_FILE, bills)

