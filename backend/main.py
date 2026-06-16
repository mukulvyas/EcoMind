from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

from routers import footprint, bills, ai_coach, govt_data

app = FastAPI(title="EcoMind API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(footprint.router, prefix="/api/footprint")
app.include_router(bills.router, prefix="/api/bills")
app.include_router(ai_coach.router, prefix="/api/chat")
app.include_router(govt_data.router, prefix="/api/govt")
