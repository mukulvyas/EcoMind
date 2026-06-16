# 🌿 EcoMind — AI Carbon Footprint Coach

> Know your impact. Change your future.

EcoMind is an AI-powered carbon footprint awareness 
platform built for Indian users. It helps you track, 
understand, and reduce your carbon emissions through 
personalized insights powered by Google Gemini.

Built for PromptWars Hackathon 2024.

---

## ✨ Features

- Carbon Footprint Calculator (travel, food, energy, shopping)
- AI Coach powered by Google Gemini 2.0 Flash
- Bill Upload & Analysis using Gemini Vision
- India Climate Intelligence (CEA, CPCB, PPAC data)
- 30-day Personalized Action Plan
- Carbon Offset Marketplace (India projects)
- Progress Dashboard with trend charts

---

## 🛠 Tech Stack

Frontend  — React, Tailwind CSS, Recharts, Lucide Icons
Backend   — Python, FastAPI, Uvicorn
AI        — Google Gemini 2.0 Flash + Gemini Vision
Database  — Local JSON (Cloud Firestore ready)
Deploy    — Google Cloud Run

---

## 🚀 Getting Started

### 1. Clone the repo
git clone https://github.com/yourusername/ecomind.git
cd ecomind

### 2. Set up backend
cd backend
python -m venv venv
source venv/bin/activate  (Mac/Linux)
venv\Scripts\activate     (Windows)
pip install -r requirements.txt

### 3. Add your API keys
cp .env.example .env
Then open .env and fill in your keys (see below)

### 4. Run backend
uvicorn main:app --reload --port 8080

### 5. Set up frontend
cd ../frontend
npm install
cp .env.example .env
Then add your backend URL to frontend .env

### 6. Run frontend
npm run dev

Open http://localhost:5173

---

## 🔑 Environment Variables

### backend/.env
GEMINI_API_KEY=        ← Get from aistudio.google.com
DATA_GOV_API_KEY=      ← Get from data.gov.in (optional)

### frontend/.env
VITE_API_URL=http://localhost:8080

⚠️ Never commit your .env files.
They are already in .gitignore.

---

## 📡 API Endpoints

POST /api/footprint/calculate   Calculate CO₂ footprint
GET  /api/footprint/history     Get past entries
POST /api/chat                  Chat with EcoMind AI
POST /api/chat/action-plan      Generate 30-day plan
POST /api/bills/upload          Analyze utility bill
GET  /api/govt/live             Live India climate data

Full docs at http://localhost:8080/docs

---

## 📊 Data Sources

| Data | Source |
|------|--------|
| Grid emission factors | CEA Annual Report 2023-24 |
| Air Quality Index | CPCB Annual Report 2023 |
| Weather | Open-Meteo (open-meteo.com) |
| Petroleum data | PPAC, Ministry of Petroleum |
| National CO₂ budget | MoEFCC NDC Report 2023 |
| Fuel prices | PPAC India, June 2024 |

---

## 🌍 Carbon Calculation Methods

Electricity  : units (kWh) × state grid factor (CEA)
LPG          : weight (kg) × 2.98 kg CO₂
Petrol       : volume (L) × 2.31 kg CO₂
Flights      : number × 0.255 tonnes CO₂ per flight
Diet (mixed) : 1.2 tonnes CO₂ per year (BEE estimate)

---

## ☁️ Deploy to Google Cloud Run

# Backend
gcloud run deploy ecomind-api \
  --source ./backend \
  --region us-central1 \
  --set-env-vars GEMINI_API_KEY=your_key \
  --allow-unauthenticated

# Frontend  
gcloud run deploy ecomind-frontend \
  --source ./frontend \
  --region us-central1 \
  --allow-unauthenticated

---

## 📁 Project Structure

ecomind/
├── backend/
│   ├── main.py
│   ├── routers/
│   │   ├── footprint.py
│   │   ├── bills.py
│   │   ├── ai_coach.py
│   │   └── govt_data.py
│   ├── services/
│   │   ├── gemini_service.py
│   │   ├── govt_service.py
│   │   └── local_storage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── services/api.js
│   ├── Dockerfile
│   └── .env.example
├── .gitignore
└── README.md

---

## 👥 Team

Built with ❤️ for PromptWars Hackathon
Powered by Google Gemini + FastAPI + React

---
