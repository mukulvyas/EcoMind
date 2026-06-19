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

            # For actual requests, inject CORS + security headers into response
            if origin and _is_allowed_origin(origin):
                origin_bytes = origin.encode()

                async def send_with_cors(message):
                    if message["type"] == "http.response.start":
                        headers_list = list(message.get("headers", []))
                        headers_list.append((b"access-control-allow-origin", origin_bytes))
                        headers_list.append((b"access-control-allow-credentials", b"true"))
                        headers_list.append((b"x-content-type-options", b"nosniff"))
                        headers_list.append((b"x-frame-options", b"DENY"))
                        headers_list.append((b"x-xss-protection", b"1; mode=block"))
                        headers_list.append((
                            b"content-security-policy",
                            b"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                            b"img-src 'self' data: https:; connect-src 'self' https://api.open-meteo.com; "
                            b"frame-ancestors 'none';"
                        ))
                        headers_list.append((
                            b"strict-transport-security",
                            b"max-age=31536000; includeSubDomains"
                        ))
                        headers_list.append((b"referrer-policy", b"strict-origin-when-cross-origin"))
                        headers_list.append((
                            b"permissions-policy",
                            b"geolocation=(), microphone=(), camera=()"
                        ))
                        message = {**message, "headers": headers_list}
                    await send(message)

                await self.app(scope, receive, send_with_cors)
                return

        await self.app(scope, receive, send)

app.add_middleware(DynamicCORSMiddleware)

# ─── Constants ────────────────────────────────────────────────────────────────
SESSION_ID_MAX_LENGTH = 128
MAX_REQUEST_BODY_BYTES = 20 * 1024 * 1024  # 20 MB

def is_valid_uuid(value) -> bool:
    """
    Validate that the given value is a well-formed UUID v4 or a Firebase UID.

    Args:
        value: The session ID string to validate.

    Returns:
        bool: True if the value is a valid UUID v4 or Firebase UID, False otherwise.
    """
    if not isinstance(value, str):
        return False
    # Reject excessively long strings before any further checks
    if len(value) > SESSION_ID_MAX_LENGTH:
        return False
    try:
        uuid.UUID(str(value), version=4)
        return True
    except ValueError:
        # Fallback for Firebase UIDs (alphanumeric, ~28 chars)
        if len(value) >= 28 and value.isalnum():
            return True
        return False

# ─── Bounded Rate-Limit Store (LRU eviction at 10 000 sessions) ──────────────
RATE_LIMIT_STORE: dict[str, list[float]] = {}
RATE_LIMIT_MAX_REQUESTS = 30
RATE_LIMIT_WINDOW_SEC = 60
RATE_LIMIT_MAX_SESSIONS = 10_000  # prevent unbounded memory growth


def _evict_oldest_session() -> None:
    """Remove the session with the oldest most-recent request to keep store bounded."""
    if not RATE_LIMIT_STORE:
        return
    oldest_key = min(
        RATE_LIMIT_STORE,
        key=lambda k: RATE_LIMIT_STORE[k][-1] if RATE_LIMIT_STORE[k] else 0,
    )
    del RATE_LIMIT_STORE[oldest_key]


@app.middleware("http")
async def body_size_middleware(request: Request, call_next):
    """Reject requests whose body exceeds MAX_REQUEST_BODY_BYTES."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_BODY_BYTES:
        return JSONResponse(
            status_code=413,
            content={"error": "Request body too large"},
        )
    return await call_next(request)


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    """
    Enforce session ID validation and per-session rate limiting.

    Args:
        request: The incoming HTTP request.
        call_next: ASGI callable for the next middleware/handler.

    Returns:
        JSONResponse with 400 if session is invalid, 429 if rate-limited,
        or the normal response otherwise.
    """
    # Skip validation for GET /health and CORS preflight OPTIONS
    if (request.method == "GET" and request.url.path == "/health") or request.method == "OPTIONS":
        return await call_next(request)

    session_id = request.headers.get("X-Session-ID")
    if not session_id or not is_valid_uuid(session_id):
        return JSONResponse(status_code=400, content={"error": "Invalid session"})

    # Rate Limiting
    now = time.time()
    if session_id not in RATE_LIMIT_STORE:
        # Evict oldest entry if store is full
        if len(RATE_LIMIT_STORE) >= RATE_LIMIT_MAX_SESSIONS:
            _evict_oldest_session()
        RATE_LIMIT_STORE[session_id] = []

    # Clean up old requests outside the sliding window
    RATE_LIMIT_STORE[session_id] = [
        ts for ts in RATE_LIMIT_STORE[session_id] if now - ts < RATE_LIMIT_WINDOW_SEC
    ]

    if len(RATE_LIMIT_STORE[session_id]) >= RATE_LIMIT_MAX_REQUESTS:
        return JSONResponse(status_code=429, content={"error": "Too many requests, slow down"})

    RATE_LIMIT_STORE[session_id].append(now)

    response = await call_next(request)
    return response

@app.get("/health")
async def health():
    """
    Health check endpoint — no auth required.

    Returns:
        dict: status, service name, and version.
    """
    return {
        "status": "ok",
        "service": "EcoMind API",
        "version": "2.0.0"
    }

app.include_router(footprint.router, prefix="/api/footprint")
app.include_router(bills.router, prefix="/api/bills")
app.include_router(ai_coach.router, prefix="/api/chat")
app.include_router(govt_data.router, prefix="/api/govt")
