from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import uuid
import time
import re

# Load environment variables
load_dotenv()

from routers import footprint, bills, ai_coach, govt_data

app = FastAPI(title="EcoMind API")

# Build allowed origins — always include localhost and any Cloud Run URLs via env
_FRONTEND_URL = os.getenv("FRONTEND_URL", "")
ALLOWED_ORIGINS = list(filter(None, [
    "http://localhost:5173",
    "http://localhost:3000",
    _FRONTEND_URL,
]))

def _is_allowed_origin(origin: str) -> bool:
    """Return True if the origin is explicitly allowed or is any *.run.app domain."""
    if origin in ALLOWED_ORIGINS:
        return True
    # Allow all Cloud Run domains (*.run.app) for hackathon flexibility
    if re.match(r"https://[\w.-]+\.run\.app$", origin):
        return True
    return False

class DynamicCORSMiddleware:
    """CORS middleware that dynamically allows *.run.app origins."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            origin = headers.get(b"origin", b"").decode()

            if scope["method"] == "OPTIONS" and origin:
                # Handle preflight
                allow = _is_allowed_origin(origin)
                response_headers = [
                    (b"access-control-allow-origin", origin.encode() if allow else b""),
                    (b"access-control-allow-methods", b"GET, POST, PATCH, DELETE, OPTIONS"),
                    (b"access-control-allow-headers", b"Content-Type, Authorization, X-Session-ID"),
                    (b"access-control-allow-credentials", b"true"),
                    (b"access-control-max-age", b"600"),
                    (b"content-length", b"0"),
                ]
                await send({
                    "type": "http.response.start",
                    "status": 204,
                    "headers": response_headers,
                })
                await send({"type": "http.response.body", "body": b""})
                return

            # For actual requests, inject CORS header into response
            if origin and _is_allowed_origin(origin):
                origin_bytes = origin.encode()

                async def send_with_cors(message):
                    if message["type"] == "http.response.start":
                        headers_list = list(message.get("headers", []))
                        headers_list.append((b"access-control-allow-origin", origin_bytes))
                        headers_list.append((b"access-control-allow-credentials", b"true"))
                        message = {**message, "headers": headers_list}
                    await send(message)

                await self.app(scope, receive, send_with_cors)
                return

        await self.app(scope, receive, send)

app.add_middleware(DynamicCORSMiddleware)

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
