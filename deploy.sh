#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  ESG Compass — Google Cloud Platform Deployment Script
#  Run this from the project root directory.
# ═══════════════════════════════════════════════════════════════════════════════
set -e

# ────────────────────────────────────────────────────────────────────────────────
# CONFIGURATION — Edit these before running
# ────────────────────────────────────────────────────────────────────────────────
PROJECT_ID="esg-compass-prod"      # Your GCP project ID
REGION="me-central1"               # Region (me-central1 = Doha, closest to UAE)
DB_INSTANCE="esg-db"               # Cloud SQL instance name
DB_NAME="esg_portal"               # Database name
DB_USER="esg_admin"                # Database user
DB_PASSWORD="CHANGE_ME_STRONG_PASSWORD"   # ← CHANGE THIS!

# Secrets (will be stored in Secret Manager)
SECRET_KEY="CHANGE_ME_RANDOM_64_CHARS"   # ← CHANGE THIS! (JWT signing key)
DEV_SECRET="CHANGE_ME_ADMIN_KEY"         # ← CHANGE THIS! (Developer Admin key)
SMTP_USER_VAL="your-email@gmail.com"     # Your Gmail
SMTP_PASS_VAL="your-app-password"        # Gmail App Password
EMAIL_FROM="your-email@gmail.com"

# ────────────────────────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║    ESG Compass — GCP Deployment                  ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Create Project & Enable APIs
# ═══════════════════════════════════════════════════════════════════════════════
echo "▶ Step 1: Setting up GCP project..."
gcloud config set project $PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Create Artifact Registry (Docker repo)
# ═══════════════════════════════════════════════════════════════════════════════
echo "▶ Step 2: Creating Artifact Registry..."
gcloud artifacts repositories create esg-portal \
  --repository-format=docker \
  --location=$REGION \
  --description="ESG Portal Docker images" \
  2>/dev/null || echo "   (Repository already exists)"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Create Cloud SQL PostgreSQL Instance
# ═══════════════════════════════════════════════════════════════════════════════
echo "▶ Step 3: Creating Cloud SQL instance (this takes 5-10 minutes)..."
gcloud sql instances create $DB_INSTANCE \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-size=10GB \
  --storage-auto-increase \
  --no-assign-ip \
  --network=default \
  2>/dev/null || echo "   (Instance already exists)"

# Create database and user
gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE \
  2>/dev/null || echo "   (Database already exists)"

gcloud sql users create $DB_USER \
  --instance=$DB_INSTANCE \
  --password=$DB_PASSWORD \
  2>/dev/null || echo "   (User already exists)"

# Get the private IP
DB_IP=$(gcloud sql instances describe $DB_INSTANCE --format='value(ipAddresses[0].ipAddress)')
DATABASE_URL="postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@${DB_IP}:5432/${DB_NAME}"
echo "   Database URL: $DATABASE_URL"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Store Secrets in Secret Manager
# ═══════════════════════════════════════════════════════════════════════════════
echo "▶ Step 4: Storing secrets..."

create_secret() {
  local name=$1
  local value=$2
  echo -n "$value" | gcloud secrets create "$name" --data-file=- 2>/dev/null || \
  echo -n "$value" | gcloud secrets versions add "$name" --data-file=-
}

create_secret "DATABASE_URL" "$DATABASE_URL"
create_secret "SECRET_KEY" "$SECRET_KEY"
create_secret "DEVELOPER_ADMIN_SECRET" "$DEV_SECRET"
create_secret "SMTP_USER" "$SMTP_USER_VAL"
create_secret "SMTP_PASSWORD" "$SMTP_PASS_VAL"
create_secret "EMAILS_FROM_EMAIL" "$EMAIL_FROM"

# Grant Cloud Run access to secrets
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Build & Deploy Backend to Cloud Run
# ═══════════════════════════════════════════════════════════════════════════════
echo "▶ Step 5: Building & deploying backend..."

# Build Docker image via Cloud Build
gcloud builds submit ./backend \
  --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/esg-portal/esg-backend:latest

# Deploy to Cloud Run
gcloud run deploy esg-backend \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/esg-portal/esg-backend:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "ENVIRONMENT=production,FRONTEND_URL=https://${PROJECT_ID}.web.app" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,DEVELOPER_ADMIN_SECRET=DEVELOPER_ADMIN_SECRET:latest,SMTP_USER=SMTP_USER:latest,SMTP_PASSWORD=SMTP_PASSWORD:latest,EMAILS_FROM_EMAIL=EMAILS_FROM_EMAIL:latest" \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --add-cloudsql-instances "${PROJECT_ID}:${REGION}:${DB_INSTANCE}"

# Get the backend URL
BACKEND_URL=$(gcloud run services describe esg-backend --region=$REGION --format='value(status.url)')
echo ""
echo "   ✅ Backend deployed at: $BACKEND_URL"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: Run Database Migrations
# ═══════════════════════════════════════════════════════════════════════════════
echo "▶ Step 6: Running database migrations..."
echo "   NOTE: Run this manually via Cloud SQL Auth Proxy:"
echo ""
echo "   # Install Cloud SQL Auth Proxy:"
echo "   # https://cloud.google.com/sql/docs/postgres/connect-auth-proxy"
echo ""
echo "   # Then run:"
echo "   cloud-sql-proxy ${PROJECT_ID}:${REGION}:${DB_INSTANCE} &"
echo "   cd backend"
echo "   DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME} alembic upgrade head"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: Build & Deploy Frontend
# ═══════════════════════════════════════════════════════════════════════════════
echo "▶ Step 7: Building & deploying frontend..."

# Update frontend API URL
cd frontend
echo "VITE_API_URL=${BACKEND_URL}/api/v1" > .env.production

# Build
npm install
npm run build

# Deploy to Firebase
npx firebase-tools deploy --only hosting --project $PROJECT_ID
cd ..

FRONTEND_URL="https://${PROJECT_ID}.web.app"
echo ""
echo "   ✅ Frontend deployed at: $FRONTEND_URL"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: Update Backend CORS with actual frontend URL
# ═══════════════════════════════════════════════════════════════════════════════
echo "▶ Step 8: Updating backend CORS for frontend URL..."
gcloud run services update esg-backend \
  --region $REGION \
  --update-env-vars "FRONTEND_URL=${FRONTEND_URL}"

# ═══════════════════════════════════════════════════════════════════════════════
# DONE!
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                 🚀 DEPLOYMENT COMPLETE!                      ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  Frontend:  $FRONTEND_URL"
echo "║  Backend:   $BACKEND_URL"
echo "║  Database:  Cloud SQL ($DB_INSTANCE)"
echo "║                                                              ║"
echo "║  Next Steps:                                                 ║"
echo "║  1. Run Alembic migrations (see Step 6 output)               ║"
echo "║  2. Open $FRONTEND_URL"
echo "║  3. Register your first admin account                        ║"
echo "║  4. Go to Developer Admin, use 'Seed Defaults' button        ║"
echo "║                                                              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
