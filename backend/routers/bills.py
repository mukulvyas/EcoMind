from fastapi import APIRouter, UploadFile, File, Form
from services.gemini_service import analyze_bill_image
from services.firestore_service import save_bill

router = APIRouter()

@router.post("/upload")
async def upload_bill(
    file: UploadFile = File(...),
    bill_type: str = Form(...),   # electricity / lpg / fuel / food
    session_id: str = Form(...)
):
    # 1. Read raw image bytes
    image_bytes = await file.read()

    # 2. Gemini extracts structured data
    bill_data = await analyze_bill_image(image_bytes, file.filename, bill_type)

    # 3. Save bill result locally
    await save_bill(session_id, bill_data)

    # 4. Create descriptive message
    units_label = "items" if bill_type == "food" else "units"
    provider = bill_data.get("provider", "Unknown Provider")
    units = bill_data.get("units", 0)
    co2_kg = bill_data.get("co2_kg", 0.0)
    
    message = f"Extracted {units} {units_label} from {provider} {bill_type} bill. Estimated CO₂ footprint: {co2_kg} kg."

    return {
        "bill_data": bill_data,   # {units, period, amount, provider, bill_type, co2_kg}
        "message": message
    }

