from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from services.gemini_service import chat_with_ecomind, generate_action_plan
from services.firestore_service import (
    get_latest_footprint,
    save_chat_message,
    get_chat_history,
    save_action_plan,
    get_latest_action_plan,
    update_action_item,
    get_all_bills,
)
from services.verification_agent import verify_action_completion

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    session_id: str
    messages: list[ChatMessage]

class ActionToggle(BaseModel):
    completed: bool
    user_claim: Optional[str] = ""


@router.post("/")
async def chat(req: ChatRequest):
    footprint = await get_latest_footprint(req.session_id)
    chat_history = await get_chat_history(req.session_id)
    active_plan = await get_latest_action_plan(req.session_id)
    bills = await get_all_bills(req.session_id)

    # Save user message
    if req.messages:
        last = req.messages[-1]
        await save_chat_message(req.session_id, last.role, last.content)

    reply = await chat_with_ecomind(
        messages=[m.dict() for m in req.messages],
        footprint=footprint,
        historical_chat=chat_history,
        active_plan=active_plan,
        recent_bills=bills[:5]
    )

    await save_chat_message(req.session_id, "assistant", reply)
    return {"reply": reply}


@router.post("/action-plan")
async def get_action_plan_endpoint(req: ChatRequest):
    footprint = await get_latest_footprint(req.session_id)
    plan_actions = await generate_action_plan(footprint)

    # Save full structured plan
    plan_id = await save_action_plan(req.session_id, plan_actions)

    return {"plan": plan_actions, "plan_id": plan_id}


@router.get("/action-plan/{session_id}")
async def fetch_action_plan(session_id: str):
    plan = await get_latest_action_plan(session_id)
    return {"plan": plan}


@router.patch("/action/{session_id}/{plan_id}/{day}")
async def toggle_action(session_id: str, plan_id: str, day: int, body: ActionToggle):
    # Get plan to find action details for verification
    plan = await get_latest_action_plan(session_id)
    action_detail = {}
    if plan and plan.get("actions"):
        for a in plan["actions"]:
            if a.get("day") == day:
                action_detail = a
                break

    # Run verification agent if completing
    verification = {"verified": True, "co2_saved_kg": action_detail.get("co2_saving_kg", 0.5), "message": ""}
    if body.completed and body.user_claim:
        verification = await verify_action_completion(action_detail, body.user_claim)

    if verification["verified"] or not body.completed:
        await update_action_item(session_id, plan_id, day, body.completed)

    # Fetch updated plan totals
    updated_plan = await get_latest_action_plan(session_id)
    return {
        "verification": verification,
        "completed_actions": updated_plan.get("completed_actions", 0),
        "co2_saved_so_far_kg": updated_plan.get("co2_saved_so_far_kg", 0),
        "total_actions": updated_plan.get("total_actions", 30)
    }
