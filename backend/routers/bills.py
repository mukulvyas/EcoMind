"""
Bills router — upload utility bills for Gemini Vision analysis and CO₂ extraction.

Part of Challenge 3 solution: lets users understand their carbon footprint by
analysing real electricity, LPG, and fuel bills with AI-powered vision.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services.gemini_service import analyze_bill_image
from services.firestore_service import save_bill, get_all_bills, update_bill_status
from services.verification_agent import verify_bill

# ─── Upload guards ────────────────────────────────────────────────────────────
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

_ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "text/plain",
}

# Magic-byte signatures for allowed binary formats
_MAGIC_BYTES: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "JPEG"),
    (b"\x89PNG\r\n\x1a\n", "PNG"),
    (b"%PDF", "PDF"),
]

def _check_magic_bytes(data: bytes) -> bool:
    """Return True if the file starts with a recognised binary signature or is text."""
    if not data:
        return False
    for magic, _ in _MAGIC_BYTES:
        if data[:len(magic)] == magic:
            return True
    # Allow plain-text files (e.g. receipts as .txt)
    try:
        data[:512].decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False

router = APIRouter()

@router.post("/upload")
async def upload_bill(
    file: UploadFile = File(...),
    bill_type: str = Form(...),
    session_id: str = Form(...)
):
    """
    Upload a utility bill image, extract CO₂ data via Gemini Vision, and verify it.

    Pipeline:
      1. Read uploaded image bytes.
      2. Pass to Gemini Vision to extract units, amount, provider, period, co2_kg.
      3. Save to Firestore with status='pending'.
      4. Run AI verification agent to check if data is realistic.
      5. Update Firestore with verified status and corrected CO₂ if needed.
      6. Return bill_id, extracted data, verification result, and human-readable message.

    Args:
        file: The uploaded bill image (JPEG, PNG, or PDF screenshot).
        bill_type: Category of bill — 'electricity', 'lpg', 'fuel', or 'food'.
        session_id: UUID identifying the user session (from form data).

    Returns:
        dict: {
            "bill_id": str,
            "bill_data": dict (units, period, amount, provider, co2_kg),
            "verification": dict (status, confidence, notes, corrected_co2_kg),
            "message": str (user-friendly summary)
        }

    Raises:
        Exception: Gemini Vision errors fall back to simulated bill data.
                   Firestore errors are caught and logged without failing the request.
    """
    # 1. Read image bytes
    image_bytes = await file.read()

    # Validate file size
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum allowed size is 10 MB.",
        )

    # Validate MIME type reported by the client
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in _ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{content_type}'. Allowed: JPG, PNG, WebP, PDF, TXT.",
        )

    # Validate magic bytes to prevent spoofed Content-Type
    if image_bytes and not _check_magic_bytes(image_bytes):
        raise HTTPException(
            status_code=415,
            detail="File content does not match a supported format.",
        )

    # 2. Gemini Vision extraction
    bill_data = await analyze_bill_image(image_bytes, file.filename, bill_type)
    bill_data["filename"] = file.filename

    # 3. Save to Firestore with status: pending
    bill_id = await save_bill(session_id, bill_data)

    # 4. Run verification agent
    verification = await verify_bill(bill_data)

    # 5. Update Firestore with verification result
    await update_bill_status(
        session_id,
        bill_id,
        status=verification["status"],
        notes=verification["notes"],
        corrected_co2=verification["corrected_co2_kg"]
    )

    # 6. Friendly message
    units_label = "items" if bill_type == "food" else "units"
    provider = bill_data.get("provider", "Unknown Provider")
    units = bill_data.get("units", 0)
    co2_kg = verification["corrected_co2_kg"]

    status_emoji = "✓" if verification["status"] == "verified" else "⚠"
    message = (
        f"{status_emoji} {units} {units_label} from {provider} {bill_type} bill. "
        f"CO₂: {co2_kg:.1f} kg — {verification['notes']}"
    )

    return {
        "bill_id": bill_id,
        "bill_data": {**bill_data, "co2_kg": co2_kg},
        "verification": verification,
        "message": message
    }


@router.get("/all/{session_id}")
async def get_bills(session_id: str):
    """
    Retrieve all uploaded bills for a session, ordered newest-first.

    Args:
        session_id: UUID of the user session (path parameter).

    Returns:
        dict: {"bills": list[dict]} — each bill has bill_id, bill_type, units,
              co2_kg, status, provider, period, created_at.
              Returns an empty list if no bills exist or Firestore is unavailable.

    Raises:
        Exception: Firestore errors are caught and an empty list is returned.
    """
    bills = await get_all_bills(session_id)
    return {"bills": bills}
