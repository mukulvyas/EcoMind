from fastapi import APIRouter
from pydantic import BaseModel
from services.gemini_service import chat_with_ecomind, generate_action_plan
from services.firestore_service import get_latest_footprint

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    session_id: str
    messages: list[ChatMessage]

@router.post("/")
async def chat(req: ChatRequest):
    footprint = await get_latest_footprint(req.session_id)
    reply = await chat_with_ecomind(
        messages=[m.dict() for m in req.messages],
        footprint=footprint
    )
    return {"reply": reply}

@router.post("/action-plan")
async def get_action_plan_endpoint(req: ChatRequest):
    footprint = await get_latest_footprint(req.session_id)
    plan = await generate_action_plan(footprint)
    return {"plan": plan}

