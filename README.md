# 🏨 Hotel Ekdant Family Restaurant Management System

Full-stack, production-hardened restaurant management system engineered for **Hotel Ekdant** (Maharashtra, India). Features QR ordering, real-time Kitchen Display System (KDS), waiter station, GST compliance billing, table reservations, inventory tracking, and owner analytics.

---

## 🛠️ Tech Stack
- **Backend:** Flask 3, Flask-SocketIO, SQLAlchemy 2, Gunicorn, PyJWT, ReportLab, openpyxl, APScheduler.
- **Frontend:** React 19, TypeScript, React Router DOM, Vite, TailwindCSS v4, PWA (Vite PWA / Workbox).
- **Database:** PostgreSQL (production on Render) / SQLite (local dev).
- **Containerization:** Multi-stage Docker build running as an unprivileged user.

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Python 3.9+
- Node.js 20+

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run migrations and seed default database
export FLASK_APP=app.main:app
flask seed

# Start development server
python app/main.py
# Backend runs on http://127.0.0.1:5001
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000 (proxies /api and /socket.io to :5001)
```

### 4. Running Automated Tests
```bash
# Backend Pytest Suite (14 unit & integration tests)
cd backend
PYTHONPATH=. pytest tests/ -v

# Frontend Vitest Suite
cd frontend
npx vitest run

# Production Build Test
cd frontend
npm run build
```

---

## 🔐 Credentials & Security

### Initial Seed Accounts
| Username | Role | Default Password | Notes |
|---|---|---|---|
| `owner` | Owner | Configured via `INITIAL_OWNER_PASSWORD` | Full permissions |
| `manager` | Manager | `Manager@2026` | Operations & inventory |
| `cashier` | Cashier | `Cashier@2026` | Billing (max ₹100 discount) |
| `waiter1` | Waiter | `Waiter@2026` | Order taking & KOT printing |
| `chef1` | Chef | `Chef@2026` | Kitchen Display System |

> **IMPORTANT:** In production, set `INITIAL_OWNER_PASSWORD` in your environment variables. Change all default passwords immediately after initial deployment.

---

## 🌐 Production Deployment (Render.com + PostgreSQL)

1. Connect your repository to Render.com using [`render.yaml`](./render.yaml).
2. Set the following required environment variables:
   - `SECRET_KEY`: Random 32+ character string.
   - `JWT_SECRET`: Random 32+ character string.
   - `INITIAL_OWNER_PASSWORD`: Strong owner password.
   - `DATABASE_URL`: Managed PostgreSQL connection string.
3. The Docker container automatically builds frontend assets into `frontend/dist/` and runs Gunicorn with 8 worker threads on port `10000`.

---

## 💾 Backups
A production backup script is provided in [`scripts/backup.sh`](./scripts/backup.sh):
```bash
./scripts/backup.sh
```
This dumps and gzips the database to the `./backups/` directory.
