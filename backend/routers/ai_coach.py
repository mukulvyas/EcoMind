"""
AI Coach router — chat, action plan generation, and action completion verification.

Aligns with Challenge 3: helping individuals understand, track, and reduce their
carbon footprint through simple actions and personalized insights.
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field
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
    role: str = Field(..., description="Speaker role: 'user' or 'assistant'")
    content: str = Field(..., max_length=2000, description="Message text (max 2000 chars)")

class ChatRequest(BaseModel):
    session_id: str = Field(..., description="UUID identifying the user session")
    messages: list[ChatMessage] = Field(..., description="Full conversation history")

class ActionToggle(BaseModel):
    completed: bool = Field(..., description="True to mark complete, False to unmark")
    user_claim: Optional[str] = Field(
        default="",
        max_length=500,
        description="User's description of how they completed the action (max 500 chars)"
    )


@router.post("/")
async def chat(req: ChatRequest):
    """
    Send a message to the EcoCoach AI and receive a personalised carbon-reduction insight.

    Fetches the user's latest footprint, bill history, and active action plan as RAG
    context so the AI can give India-specific, personalised advice (≤3 sentences).

    Args:
        req: ChatRequest containing session_id and full conversation messages list.

    Returns:
        dict: {"reply": str} — the AI coach's response text.

    Raises:
        Exception: Gemini errors are caught in gemini_service and returned as
                   an error string in the reply field rather than raising HTTP errors.
    """
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
    """
    Generate a personalised 30-day carbon reduction action plan using Gemini.

    Uses the user's footprint breakdown to identify the biggest emission category
    and creates India-specific daily actions tailored to that category.

    Args:
        req: ChatRequest containing session_id (messages not used but required by schema).

    Returns:
        dict: {"plan": list[dict], "plan_id": str}
              Each plan item has: day, action, category, co2_saving_kg, difficulty.

    Raises:
        Exception: Gemini errors fall back to a default 30-day mock plan.
    """
    footprint = await get_latest_footprint(req.session_id)
    plan_actions = await generate_action_plan(footprint)

    # Save full structured plan to Firestore for persistence and progress tracking
    plan_id = await save_action_plan(req.session_id, plan_actions)

    return {"plan": plan_actions, "plan_id": plan_id}


@router.get("/action-plan/{session_id}")
async def fetch_action_plan(session_id: str):
    """
    Fetch the user's most recent active action plan from Firestore.

    Args:
        session_id: UUID identifying the user session (path parameter).

    Returns:
        dict: {"plan": dict} — the latest action plan, or empty dict if none exists.

    Raises:
        Exception: Firestore errors return an empty plan dict gracefully.
    """
    plan = await get_latest_action_plan(session_id)
    return {"plan": plan}


@router.patch("/action/{session_id}/{plan_id}/{day}")
async def toggle_action(session_id: str, plan_id: str, day: int, body: ActionToggle):
    """
    Mark a daily action as completed or uncompleted, with optional AI verification.

    When completing an action, the user's claim is passed to the verification agent
    which uses Gemini to assess whether the claim is believable before awarding CO₂ savings.

    Args:
        session_id: UUID of the user session.
        plan_id: UUID of the action plan to update.
        day: Day number (1–30) of the action to toggle.
        body: ActionToggle with completed status and optional user_claim text.

    Returns:
        dict: verification result, updated completed_actions count, co2_saved_so_far_kg,
              and total_actions from the refreshed plan.

    Raises:
        Exception: Firestore or Gemini errors are caught; defaults to verified=True.
    """
    # Get plan to find action details for verification context
    plan = await get_latest_action_plan(session_id)
    action_detail = {}
    if plan and plan.get("actions"):
        for a in plan["actions"]:
            if a.get("day") == day:
                action_detail = a
                break

    # Run AI verification agent only when completing with a claim
    verification = {
        "verified": True,
        "co2_saved_kg": action_detail.get("co2_saving_kg", 0.5),
        "message": ""
    }
    if body.completed and body.user_claim:
        verification = await verify_action_completion(action_detail, body.user_claim)

    if verification["verified"] or not body.completed:
        await update_action_item(session_id, plan_id, day, body.completed)

    # Fetch updated plan totals for real-time dashboard update
    updated_plan = await get_latest_action_plan(session_id)
    return {
        "verification": verification,
        "completed_actions": updated_plan.get("completed_actions", 0),
        "co2_saved_so_far_kg": updated_plan.get("co2_saved_so_far_kg", 0),
        "total_actions": updated_plan.get("total_actions", 30)
    }
