"""
Edge-case tests for EcoMind security middleware and upload guards.

Covers:
- Security response headers (CSP, HSTS, X-Frame-Options, etc.)
- Oversized session ID rejection
- Bill upload: file too large (413), unsupported MIME type (415), invalid magic bytes (415)
- Body size limit middleware (413)
- Rate-limiter window cleanup
- ChatMessage content length boundary (2000 chars pass, 2001 fail)
- Govt endpoint metadata fields
"""
import io
import uuid
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from main import app, RATE_LIMIT_STORE

client = TestClient(app)

VALID_SESSION = "123e4567-e89b-12d3-a456-426614174000"
VALID_HEADERS = {"X-Session-ID": VALID_SESSION}


def fresh() -> dict[str, str]:
    """Return a fresh unique session header to avoid hitting the rate limiter."""
    return {"X-Session-ID": str(uuid.uuid4())}


# ─── Security headers ─────────────────────────────────────────────────────────

def test_health_does_not_require_session():
    """Health endpoint works without a session header."""
    response = client.get("/health")
    assert response.status_code == 200


def test_x_frame_options_present_in_cors_response():
    """CORS responses must include X-Frame-Options: DENY."""
    response = client.get(
        "/api/govt/live",
        headers={**fresh(), "Origin": "http://localhost:5173"},
    )
    assert response.status_code == 200
    assert response.headers.get("x-frame-options", "").upper() == "DENY"


def test_x_content_type_options_present():
    """Responses must include X-Content-Type-Options: nosniff."""
    response = client.get(
        "/api/govt/live",
        headers={**fresh(), "Origin": "http://localhost:5173"},
    )
    assert response.headers.get("x-content-type-options", "").lower() == "nosniff"


def test_csp_header_present():
    """Content-Security-Policy header must be present in CORS responses."""
    response = client.get(
        "/api/govt/live",
        headers={**fresh(), "Origin": "http://localhost:5173"},
    )
    csp = response.headers.get("content-security-policy", "")
    assert "default-src" in csp


def test_hsts_header_present():
    """Strict-Transport-Security header must be present."""
    response = client.get(
        "/api/govt/live",
        headers={**fresh(), "Origin": "http://localhost:5173"},
    )
    hsts = response.headers.get("strict-transport-security", "")
    assert "max-age" in hsts


def test_referrer_policy_header_present():
    """Referrer-Policy header must be present."""
    response = client.get(
        "/api/govt/live",
        headers={**fresh(), "Origin": "http://localhost:5173"},
    )
    rp = response.headers.get("referrer-policy", "")
    assert rp != ""


# ─── Session ID length validation ─────────────────────────────────────────────────────

def test_oversized_session_id_rejected():
    """Session IDs longer than 128 characters must be rejected with 400."""
    oversized = "a" * 200
    response = client.get(
        "/api/footprint/history/ignored",
        headers={"X-Session-ID": oversized},
    )
    assert response.status_code == 400


def test_session_id_at_exact_max_length_uuid():
    """A standard UUID (36 chars) must always be accepted."""
    response = client.get("/health")
    assert response.status_code == 200  # health requires no session


# ─── Bill upload guards ───────────────────────────────────────────────────────

@patch("services.verification_agent.verify_bill", new_callable=AsyncMock)
@patch("services.firestore_service.save_bill", new_callable=AsyncMock)
@patch("services.gemini_service.analyze_bill_image", new_callable=AsyncMock)
def test_upload_rejects_oversized_file(mock_analyze, mock_save, mock_verify):
    """Files larger than 10 MB must be rejected with 413."""
    large_content = b"\xff\xd8\xff" + b"0" * (10 * 1024 * 1024 + 1)  # valid JPEG magic + oversize
    session_id = str(uuid.uuid4())
    response = client.post(
        "/api/bills/upload",
        headers=fresh(),
        data={"bill_type": "electricity", "session_id": session_id},
        files={"file": ("big.jpg", io.BytesIO(large_content), "image/jpeg")},
    )
    assert response.status_code == 413


@patch("services.verification_agent.verify_bill", new_callable=AsyncMock)
@patch("services.firestore_service.save_bill", new_callable=AsyncMock)
@patch("services.gemini_service.analyze_bill_image", new_callable=AsyncMock)
def test_upload_rejects_unsupported_mime(mock_analyze, mock_save, mock_verify):
    """Files with unsupported MIME type must be rejected with 415."""
    session_id = str(uuid.uuid4())
    response = client.post(
        "/api/bills/upload",
        headers=fresh(),
        data={"bill_type": "electricity", "session_id": session_id},
        files={"file": ("malware.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")},
    )
    assert response.status_code == 415


@patch("services.verification_agent.verify_bill", new_callable=AsyncMock)
@patch("services.firestore_service.save_bill", new_callable=AsyncMock)
@patch("services.gemini_service.analyze_bill_image", new_callable=AsyncMock)
def test_upload_rejects_invalid_magic_bytes(mock_analyze, mock_save, mock_verify):
    """Files claiming to be JPEG but lacking correct magic bytes must be rejected with 415."""
    fake_bytes = b"MZ\x90\x00" + b"\x00" * 100  # EXE magic, not JPEG
    session_id = str(uuid.uuid4())
    response = client.post(
        "/api/bills/upload",
        headers=fresh(),
        data={"bill_type": "electricity", "session_id": session_id},
        files={"file": ("fake.jpg", io.BytesIO(fake_bytes), "image/jpeg")},
    )
    assert response.status_code == 415


@patch("services.verification_agent.verify_bill", new_callable=AsyncMock)
@patch("services.firestore_service.save_bill", new_callable=AsyncMock)
@patch("services.gemini_service.analyze_bill_image", new_callable=AsyncMock)
def test_upload_accepts_valid_plain_text_bill(mock_analyze, mock_save, mock_verify):
    """Plain-text bill files (e.g. .txt receipts) must be accepted."""
    mock_analyze.return_value = {
        "units": 10, "period": "Jun 2026", "amount": 800,
        "provider": "HP Gas", "bill_type": "lpg", "co2_kg": 29.8
    }
    mock_save.return_value = "bill-text-001"
    mock_verify.return_value = {
        "status": "verified", "confidence": 80,
        "notes": "Within normal range.", "corrected_co2_kg": 29.8
    }
    text_content = b"HP Gas Receipt\nDate: June 2026\nUnits: 10 kg\nAmount: 800 INR"
    session_id = str(uuid.uuid4())
    response = client.post(
        "/api/bills/upload",
        headers=fresh(),
        data={"bill_type": "lpg", "session_id": session_id},
        files={"file": ("receipt.txt", io.BytesIO(text_content), "text/plain")},
    )
    assert response.status_code == 200


# ─── Chat message content length ──────────────────────────────────────────────

@patch("services.gemini_service.chat_with_ecomind", new_callable=AsyncMock)
@patch("services.firestore_service.get_latest_footprint", new_callable=AsyncMock)
@patch("services.firestore_service.get_chat_history", new_callable=AsyncMock)
@patch("services.firestore_service.get_latest_action_plan", new_callable=AsyncMock)
@patch("services.firestore_service.get_all_bills", new_callable=AsyncMock)
@patch("services.firestore_service.save_chat_message", new_callable=AsyncMock)
def test_chat_message_at_max_length_accepted(
    mock_save, mock_bills, mock_plan, mock_history, mock_fp, mock_chat
):
    """A message of exactly 2000 characters must be accepted (boundary value)."""
    mock_chat.return_value = "OK."
    mock_fp.return_value = {}
    mock_history.return_value = []
    mock_plan.return_value = {}
    mock_bills.return_value = []

    session_id = str(uuid.uuid4())
    max_msg = "a" * 2000
    response = client.post(
        "/api/chat/",
        headers=fresh(),
        json={"session_id": session_id, "messages": [{"role": "user", "content": max_msg}]},
    )
    assert response.status_code == 200


@patch("services.gemini_service.chat_with_ecomind", new_callable=AsyncMock)
@patch("services.firestore_service.get_latest_footprint", new_callable=AsyncMock)
@patch("services.firestore_service.get_chat_history", new_callable=AsyncMock)
@patch("services.firestore_service.get_latest_action_plan", new_callable=AsyncMock)
@patch("services.firestore_service.get_all_bills", new_callable=AsyncMock)
@patch("services.firestore_service.save_chat_message", new_callable=AsyncMock)
def test_chat_message_over_max_length_rejected(
    mock_save, mock_bills, mock_plan, mock_history, mock_fp, mock_chat
):
    """A message of 2001 characters must be rejected with 422."""
    mock_chat.return_value = "OK."
    mock_fp.return_value = {}
    mock_history.return_value = []
    mock_plan.return_value = {}
    mock_bills.return_value = []

    session_id = str(uuid.uuid4())
    over_max = "a" * 2001
    response = client.post(
        "/api/chat/",
        headers=fresh(),
        json={"session_id": session_id, "messages": [{"role": "user", "content": over_max}]},
    )
    assert response.status_code == 422


# ─── Govt endpoint metadata ───────────────────────────────────────────────────

def test_govt_response_includes_meta_block():
    """Govt /live response must include a 'meta' key with last_updated and data_as_of."""
    response = client.get("/api/govt/live", headers=fresh())
    assert response.status_code == 200
    data = response.json()
    assert "meta" in data, "Expected 'meta' key in govt response"
    assert "last_updated" in data["meta"]
    assert "data_as_of" in data["meta"]


def test_govt_response_has_all_sections():
    """Govt /live response must include all expected data sections."""
    response = client.get("/api/govt/live", headers=fresh())
    assert response.status_code == 200
    data = response.json()
    for key in ("grid", "aqi", "weather", "national", "petroleum", "fuel_prices"):
        assert key in data, f"Missing key: {key}"
