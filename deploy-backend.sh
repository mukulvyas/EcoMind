#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# EcoMind Backend — Cloud Run Deployment Script
# Run this script ONCE to set all env vars and fix chatbot + Firestore.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - gcloud config set project ecomind-499612
#   - Your service account JSON key file downloaded from Firebase Console
#     (Firebase Console → Project Settings → Service Accounts → Generate new private key)
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ── CONFIGURATION — edit these ──────────────────────────────────────────────
PROJECT_ID="ecomind-499612"
REGION="europe-west1"                         # matches your .env.production deployment
BACKEND_SERVICE_NAME="ecomind"                # your Cloud Run backend service name
FRONTEND_URL="https://your-frontend.run.app"  # update with your actual frontend URL

# Path to your Firebase service account key JSON (downloaded from Firebase Console)
SERVICE_ACCOUNT_KEY_FILE="./firebase-service-account.json"
# ─────────────────────────────────────────────────────────────────────────────

echo "🔧 EcoMind Cloud Run Fix — setting environment variables..."

# ── Step 1: Read secrets ──────────────────────────────────────────────────────
if [ ! -f "$SERVICE_ACCOUNT_KEY_FILE" ]; then
  echo "❌ ERROR: $SERVICE_ACCOUNT_KEY_FILE not found."
  echo "   Download it from Firebase Console → Project Settings → Service Accounts."
  exit 1
fi

# Compact the JSON to a single line (required for env var injection)
FIREBASE_KEY_JSON=$(cat "$SERVICE_ACCOUNT_KEY_FILE" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)))")

echo "✅ Firebase key loaded ($(echo "$FIREBASE_KEY_JSON" | wc -c) chars)"

# ── Step 2: Prompt for GEMINI_API_KEY if not set ─────────────────────────────
if [ -z "$GEMINI_API_KEY" ]; then
  echo ""
  read -rsp "🔑 Enter your GEMINI_API_KEY: " GEMINI_API_KEY
  echo ""
fi

# ── Step 3: Update Cloud Run service env vars ────────────────────────────────
echo ""
echo "🚀 Updating Cloud Run service '$BACKEND_SERVICE_NAME' in $REGION..."

gcloud run services update "$BACKEND_SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --set-env-vars="GEMINI_API_KEY=${GEMINI_API_KEY},FRONTEND_URL=${FRONTEND_URL},FIREBASE_SERVICE_ACCOUNT_KEY=${FIREBASE_KEY_JSON}"

echo "✅ Env vars set on Cloud Run."

# ── Step 4: Grant Firestore IAM to Cloud Run's default service account ────────
# This is needed if you use ADC fallback (no FIREBASE_SERVICE_ACCOUNT_KEY set)
CLOUD_RUN_SA="${PROJECT_ID}-compute@developer.gserviceaccount.com"

echo ""
echo "🔐 Granting roles/datastore.user to $CLOUD_RUN_SA..."

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_RUN_SA}" \
  --role="roles/datastore.user" \
  --quiet

echo "✅ IAM role granted."

# ── Step 5: Verify deployment ─────────────────────────────────────────────────
echo ""
echo "🔍 Fetching service URL..."
SERVICE_URL=$(gcloud run services describe "$BACKEND_SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(status.url)")

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Done! Test your deployment:"
echo "   Health check: curl $SERVICE_URL/health"
echo "   Check logs:   gcloud run services logs read $BACKEND_SERVICE_NAME --region=$REGION --limit=50"
echo "═══════════════════════════════════════════════════════════════"
