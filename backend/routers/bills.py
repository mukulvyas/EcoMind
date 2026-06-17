from fastapi import APIRouter, UploadFile, File, Form
from services.gemini_service import analyze_bill_image
from services.firestore_service import save_bill, get_all_bills, update_bill_status
from services.verification_agent import verify_bill

router = APIRouter()

@router.post("/upload")
async def upload_bill(
    file: UploadFile = File(...),
    bill_type: str = Form(...),
    session_id: str = Form(...)
):
    # 1. Read image bytes
    image_bytes = await file.read()

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
    bills = await get_all_bills(session_id)
    return {"bills": bills}
