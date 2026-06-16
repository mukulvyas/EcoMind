from fastapi import APIRouter
from pydantic import BaseModel
from services.gemini_service import chat_with_ecomind, generate_action_plan
from services.firestore_service import (
    get_latest_footprint, 
    save_chat_message, 
    get_chat_history,
    save_action_plan,
    get_latest_action_plan
)

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
    history = await get_chat_history(req.session_id)
    active_plan = await get_latest_action_plan(req.session_id)
    
    # Save the user's latest message
    if req.messages:
        latest_user_msg = req.messages[-1]
        await save_chat_message(req.session_id, latest_user_msg.role, latest_user_msg.content)
    
    reply = await chat_with_ecomind(
        messages=[m.dict() for m in req.messages],
        footprint=footprint,
        historical_chat=history,
        active_plan=active_plan
    )
    
    # Save bot's reply
    await save_chat_message(req.session_id, "bot", reply)
    
    return {"reply": reply}

@router.post("/action-plan")
async def get_action_plan_endpoint(req: ChatRequest):
    footprint = await get_latest_footprint(req.session_id)
    plan = await generate_action_plan(footprint)
    
    # Save it persistently
    await save_action_plan(req.session_id, plan)
    
    return {"plan": plan}

@router.get("/action-plan/{session_id}")
async def fetch_action_plan(session_id: str):
    plan = await get_latest_action_plan(session_id)
    return {"plan": plan}
