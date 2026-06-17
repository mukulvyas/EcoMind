"""
Tests for AI Coach router — chat, action plan generation, and action toggling.
"""
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

VALID_SESSION = "123e4567-e89b-12d3-a456-426614174000"
VALID_HEADERS = {"X-Session-ID": VALID_SESSION}


# ─── Chat endpoint ─────────────────────────────────────────────────────────────

def test_chat_requires_session_header():
    """Requests without X-Session-ID must be rejected with 400."""
    response = client.post("/api/chat/", json={
        "session_id": VALID_SESSION,
        "messages": [{"role": "user", "content": "Hello"}]
    })
    assert response.status_code == 400


def test_chat_rejects_invalid_session():
    """Malformed session IDs must be rejected with 400."""
    response = client.post(
        "/api/chat/",
        headers={"X-Session-ID": "bad-session"},
        json={
            "session_id": "bad-session",
            "messages": [{"role": "user", "content": "Hello"}]
        }
    )
    assert response.status_code == 400


@patch("services.gemini_service.chat_with_ecomind", new_callable=AsyncMock)
@patch("services.firestore_service.get_latest_footprint", new_callable=AsyncMock)
@patch("services.firestore_service.get_chat_history", new_callable=AsyncMock)
@patch("services.firestore_service.get_latest_action_plan", new_callable=AsyncMock)
@patch("services.firestore_service.get_all_bills", new_callable=AsyncMock)
@patch("services.firestore_service.save_chat_message", new_callable=AsyncMock)
def test_chat_returns_reply(mock_save, mock_bills, mock_plan, mock_history, mock_fp, mock_chat):
    """Chat endpoint returns a reply field when Gemini responds."""
    mock_chat.return_value = "Switch to the express bus and save 1.2kg CO₂/week."
    mock_fp.return_value = {"total_co2": 2.4, "travel": 0.9, "food": 0.7, "energy": 0.5, "shopping": 0.3}
    mock_history.return_value = []
    mock_plan.return_value = {}
    mock_bills.return_value = []

    response = client.post(
        "/api/chat/",
        headers=VALID_HEADERS,
        json={
            "session_id": VALID_SESSION,
            "messages": [{"role": "user", "content": "How do I reduce transport emissions?"}]
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert isinstance(data["reply"], str)
    assert len(data["reply"]) > 0


@patch("services.gemini_service.chat_with_ecomind", new_callable=AsyncMock)
@patch("services.firestore_service.get_latest_footprint", new_callable=AsyncMock)
@patch("services.firestore_service.get_chat_history", new_callable=AsyncMock)
@patch("services.firestore_service.get_latest_action_plan", new_callable=AsyncMock)
@patch("services.firestore_service.get_all_bills", new_callable=AsyncMock)
@patch("services.firestore_service.save_chat_message", new_callable=AsyncMock)
def test_chat_empty_messages_handled(mock_save, mock_bills, mock_plan, mock_history, mock_fp, mock_chat):
    """Chat with empty message list should not crash the server."""
    mock_chat.return_value = "Hello! How can I help you reduce your carbon footprint?"
    mock_fp.return_value = {}
    mock_history.return_value = []
    mock_plan.return_value = {}
    mock_bills.return_value = []

    response = client.post(
        "/api/chat/",
        headers=VALID_HEADERS,
        json={"session_id": VALID_SESSION, "messages": []}
    )
    assert response.status_code == 200


# ─── Action Plan endpoint ──────────────────────────────────────────────────────

@patch("services.gemini_service.generate_action_plan", new_callable=AsyncMock)
@patch("services.firestore_service.get_latest_footprint", new_callable=AsyncMock)
@patch("services.firestore_service.save_action_plan", new_callable=AsyncMock)
def test_action_plan_returns_30_days(mock_save, mock_fp, mock_plan):
    """Action plan endpoint must return exactly 30 daily actions."""
    mock_fp.return_value = {"total_co2": 2.4, "travel": 0.9, "food": 0.7, "energy": 0.5, "shopping": 0.3}
    mock_plan.return_value = [
        {"day": i, "action": f"Action {i}", "category": "energy",
         "co2_saving_kg": 0.5, "difficulty": "easy"}
        for i in range(1, 31)
    ]
    mock_save.return_value = "plan-uuid-123"

    response = client.post(
        "/api/chat/action-plan",
        headers=VALID_HEADERS,
        json={"session_id": VALID_SESSION, "messages": []}
    )
    assert response.status_code == 200
    data = response.json()
    assert "plan" in data
    assert len(data["plan"]) == 30


@patch("services.gemini_service.generate_action_plan", new_callable=AsyncMock)
@patch("services.firestore_service.get_latest_footprint", new_callable=AsyncMock)
@patch("services.firestore_service.save_action_plan", new_callable=AsyncMock)
def test_action_plan_has_required_fields(mock_save, mock_fp, mock_plan):
    """Each action item must contain day, action, category, co2_saving_kg."""
    mock_fp.return_value = {}
    mock_plan.return_value = [
        {"day": i, "action": f"Walk instead of drive on day {i}",
         "category": "travel", "co2_saving_kg": 0.8, "difficulty": "easy"}
        for i in range(1, 31)
    ]
    mock_save.return_value = "plan-uuid-456"

    response = client.post(
        "/api/chat/action-plan",
        headers=VALID_HEADERS,
        json={"session_id": VALID_SESSION, "messages": []}
    )
    assert response.status_code == 200
    first_action = response.json()["plan"][0]
    for field in ("day", "action", "category", "co2_saving_kg"):
        assert field in first_action, f"Missing field: {field}"


# ─── Fetch active plan ─────────────────────────────────────────────────────────

@patch("services.firestore_service.get_latest_action_plan", new_callable=AsyncMock)
def test_fetch_action_plan_returns_plan_key(mock_plan):
    """GET action-plan/:session_id always returns a 'plan' key."""
    mock_plan.return_value = {"plan_id": "abc", "actions": [], "completed_actions": 0}

    response = client.get(
        f"/api/chat/action-plan/{VALID_SESSION}",
        headers=VALID_HEADERS
    )
    assert response.status_code == 200
    assert "plan" in response.json()


@patch("services.firestore_service.get_latest_action_plan", new_callable=AsyncMock)
def test_fetch_action_plan_empty_when_none(mock_plan):
    """GET action-plan returns empty plan dict when no plan exists."""
    mock_plan.return_value = {}

    response = client.get(
        f"/api/chat/action-plan/{VALID_SESSION}",
        headers=VALID_HEADERS
    )
    assert response.status_code == 200
    data = response.json()
    assert "plan" in data


# ─── Security: rate limiting ───────────────────────────────────────────────────

def test_rate_limit_enforced():
    """Exceeding 30 requests per minute triggers 429 Too Many Requests."""
    # Use a unique session to avoid contaminating other tests
    session = "aaaabbbb-cccc-dddd-eeee-ffffffffffff"
    headers = {"X-Session-ID": session}
    responses = []
    for _ in range(35):
        r = client.get(f"/api/footprint/history/{session}", headers=headers)
        responses.append(r.status_code)
    assert 429 in responses, "Rate limiter did not trigger after 30 requests"
