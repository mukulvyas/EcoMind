"""
Tests for the bills upload endpoint — mocking Gemini Vision and Firestore.
"""
import io
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

VALID_SESSION = "123e4567-e89b-12d3-a456-426614174000"
VALID_HEADERS = {"X-Session-ID": VALID_SESSION}


# ─── Upload endpoint ────────────────────────────────────────────────────────────

@patch("services.verification_agent.verify_bill", new_callable=AsyncMock)
@patch("services.firestore_service.update_bill_status", new_callable=AsyncMock)
@patch("services.firestore_service.save_bill", new_callable=AsyncMock)
@patch("services.gemini_service.analyze_bill_image", new_callable=AsyncMock)
def test_upload_bill_electricity_success(mock_analyze, mock_save, mock_update, mock_verify):
    """A valid electricity bill image upload should return bill_id, bill_data, verification."""
    mock_analyze.return_value = {
        "units": 220, "period": "May 2026", "amount": 1760,
        "provider": "BESCOM", "bill_type": "electricity", "co2_kg": 180.4
    }
    mock_save.return_value = "bill-uuid-001"
    mock_verify.return_value = {
        "status": "verified", "confidence": 92,
        "notes": "Consumption within typical range for Bengaluru.",
        "corrected_co2_kg": 180.4
    }

    fake_image = io.BytesIO(b"fake-image-bytes")
    response = client.post(
        "/api/bills/upload",
        headers=VALID_HEADERS,
        data={"bill_type": "electricity", "session_id": VALID_SESSION},
        files={"file": ("bill.jpg", fake_image, "image/jpeg")}
    )
    assert response.status_code == 200
    data = response.json()
    assert "bill_id" in data
    assert "verification" in data
    assert "bill_data" in data
    assert data["bill_id"] == "bill-uuid-001"


@patch("services.verification_agent.verify_bill", new_callable=AsyncMock)
@patch("services.firestore_service.update_bill_status", new_callable=AsyncMock)
@patch("services.firestore_service.save_bill", new_callable=AsyncMock)
@patch("services.gemini_service.analyze_bill_image", new_callable=AsyncMock)
def test_upload_bill_returns_co2(mock_analyze, mock_save, mock_update, mock_verify):
    """Bill upload response must include CO₂ value in bill_data."""
    mock_analyze.return_value = {
        "units": 15, "period": "Jun 2026", "amount": 860,
        "provider": "HP Gas", "bill_type": "lpg", "co2_kg": 44.7
    }
    mock_save.return_value = "bill-uuid-002"
    mock_verify.return_value = {
        "status": "verified", "confidence": 88,
        "notes": "LPG usage in normal household range.",
        "corrected_co2_kg": 44.7
    }

    fake_image = io.BytesIO(b"fake-lpg-bill")
    response = client.post(
        "/api/bills/upload",
        headers=VALID_HEADERS,
        data={"bill_type": "lpg", "session_id": VALID_SESSION},
        files={"file": ("lpg_bill.jpg", fake_image, "image/jpeg")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["bill_data"]["co2_kg"] > 0


@patch("services.verification_agent.verify_bill", new_callable=AsyncMock)
@patch("services.firestore_service.update_bill_status", new_callable=AsyncMock)
@patch("services.firestore_service.save_bill", new_callable=AsyncMock)
@patch("services.gemini_service.analyze_bill_image", new_callable=AsyncMock)
def test_upload_bill_suspicious_status(mock_analyze, mock_save, mock_update, mock_verify):
    """Suspicious bill should return status 'suspicious' in verification."""
    mock_analyze.return_value = {
        "units": 9999, "period": "May 2026", "amount": 99000,
        "provider": "BESCOM", "bill_type": "electricity", "co2_kg": 8199.18
    }
    mock_save.return_value = "bill-uuid-003"
    mock_verify.return_value = {
        "status": "suspicious", "confidence": 30,
        "notes": "Unusually high consumption — possible data extraction error.",
        "corrected_co2_kg": 164.0
    }

    fake_image = io.BytesIO(b"fake-image")
    response = client.post(
        "/api/bills/upload",
        headers=VALID_HEADERS,
        data={"bill_type": "electricity", "session_id": VALID_SESSION},
        files={"file": ("weird_bill.jpg", fake_image, "image/jpeg")}
    )
    assert response.status_code == 200
    assert response.json()["verification"]["status"] == "suspicious"


def test_upload_bill_requires_session():
    """Bill upload without X-Session-ID must return 400."""
    fake_image = io.BytesIO(b"fake-image")
    response = client.post(
        "/api/bills/upload",
        data={"bill_type": "electricity", "session_id": VALID_SESSION},
        files={"file": ("bill.jpg", fake_image, "image/jpeg")}
    )
    assert response.status_code == 400


@patch("services.firestore_service.get_all_bills", new_callable=AsyncMock)
def test_get_all_bills_returns_list(mock_bills):
    """GET /bills/all/:session_id should always return a list."""
    mock_bills.return_value = [
        {"bill_id": "b1", "bill_type": "electricity", "co2_kg": 150.0, "status": "verified"}
    ]
    response = client.get(
        f"/api/bills/all/{VALID_SESSION}",
        headers=VALID_HEADERS
    )
    assert response.status_code == 200
    data = response.json()
    assert "bills" in data
    assert isinstance(data["bills"], list)


@patch("services.firestore_service.get_all_bills", new_callable=AsyncMock)
def test_get_all_bills_empty_when_none(mock_bills):
    """GET /bills/all returns empty list when user has no bills."""
    mock_bills.return_value = []
    response = client.get(
        f"/api/bills/all/{VALID_SESSION}",
        headers=VALID_HEADERS
    )
    assert response.status_code == 200
    assert response.json()["bills"] == []
