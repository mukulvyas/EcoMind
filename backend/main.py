from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import uuid
import time

# Load environment variables
load_dotenv()

from routers import footprint, bills, ai_coach, govt_data

app = FastAPI(title="EcoMind API")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", "http://localhost:5173")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Session-ID"],
)

def is_valid_uuid(value) -> bool:
    try:
        uuid.UUID(str(value), version=4)
        return True
    except ValueError:
        # Fallback for Firebase UIDs (alphanumeric, ~28 chars)
        if isinstance(value, str) and len(value) >= 28 and value.isalnum():
            return True
        return False

RATE_LIMIT_STORE = {}
RATE_LIMIT_MAX_REQUESTS = 30
RATE_LIMIT_WINDOW_SEC = 60

@app.middleware("http")
async def security_middleware(request: Request, call_next):
    # Skip validation for GET /health and CORS preflight OPTIONS
    if (request.method == "GET" and request.url.path == "/health") or request.method == "OPTIONS":
        return await call_next(request)

    session_id = request.headers.get("X-Session-ID")
    if not session_id or not is_valid_uuid(session_id):
        return JSONResponse(status_code=400, content={"error": "Invalid session"})

    # Rate Limiting
    now = time.time()
    if session_id not in RATE_LIMIT_STORE:
        RATE_LIMIT_STORE[session_id] = []
    
    # Clean up old requests
    RATE_LIMIT_STORE[session_id] = [ts for ts in RATE_LIMIT_STORE[session_id] if now - ts < RATE_LIMIT_WINDOW_SEC]
    
    if len(RATE_LIMIT_STORE[session_id]) >= RATE_LIMIT_MAX_REQUESTS:
        return JSONResponse(status_code=429, content={"error": "Too many requests, slow down"})
    
    RATE_LIMIT_STORE[session_id].append(now)

    response = await call_next(request)
    return response

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "EcoMind API",
        "version": "2.0.0"
    }

app.include_router(footprint.router, prefix="/api/footprint")
app.include_router(bills.router, prefix="/api/bills")
app.include_router(ai_coach.router, prefix="/api/chat")
app.include_router(govt_data.router, prefix="/api/govt")
