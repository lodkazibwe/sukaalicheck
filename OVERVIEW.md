# SukaaliCheck — System Overview

> High-level walkthrough of the codebase. For a deeper, code-level explanation of the business
> rules see **[BUSINESS_LOGIC.md](BUSINESS_LOGIC.md)**.

## What it is

SukaaliCheck is an **AI-assisted Type-2 diabetes risk screening tool** for clinics and herbal
facilities in Uganda. A facility registers, is approved by an admin, pays for a subscription, and
then its staff can:

1. Enter a patient's data (age, body measurements, medical history, lifestyle, blood glucose),
2. Get an instant **risk prediction** (low / intermediate / high) from a machine-learning model,
3. Download/print a **PDF screening report**,
4. Review a **history of past screenings**.

Facilities are managed through a separate **admin portal** (approve/reject signups, manage
subscriptions, and toggle whether real mobile-money payment is required).

## Monorepo layout

```
sukaalicheckAll/
  sukaalicheck/            # Frontend — Next.js 16 (App Router, static export)
  sukaali-check-backend/   # Backend  — Python 3.11+ / FastAPI + PostgreSQL
  docker-compose.yml       # Orchestrates frontend + backend + certbot in production
  DEPLOYMENT.md            # Digital Ocean deployment guide (Docker + GitHub Actions)
  OVERVIEW.md              # This file
  BUSINESS_LOGIC.md        # Detailed business-logic reference
```

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router, static export), TypeScript, Tailwind CSS v4 |
| Frontend state | Zustand (auth/session), TanStack Query (server data) |
| Frontend forms | React Hook Form + Zod validation |
| **Backend** | FastAPI, SQLAlchemy 2 + psycopg3, Alembic (migrations) |
| Auth | JWT (HS256), bcrypt password/OTP hashing |
| ML | scikit-learn Random Forest model (loaded via joblib) |
| Email | Resend HTTP API (approval OTP + admin notifications) |
| Payments | MTN MoMo Collection API (via `httpx`) |
| Database | PostgreSQL |
| Deploy | Docker Compose on a Digital Ocean droplet, GitHub Actions CI/CD |

## How the pieces fit

```
                        ┌─────────────────────────────────────────────┐
                        │            Next.js frontend (SPA)            │
   Browser  ───────────▶│  app/(auth) · app/(app) · app/admin          │
   (staff / admin)      │  Zustand session · TanStack Query · fetch    │
                        └───────────────┬─────────────────────────────┘
                                        │  HTTPS  REST  /api/v1/*
                                        ▼
                        ┌─────────────────────────────────────────────┐
                        │              FastAPI backend                 │
                        │                                              │
                        │   route  ──▶  service  ──▶  repository       │
                        │  (api/routes) (services)  (repositories)     │
                        │                                │             │
                        │        core/ (security, momo,  ▼             │
                        │         email, model, exc)   SQLAlchemy       │
                        └───────┬───────────────┬───────────┬─────────┘
                                │               │           │
                         ┌──────▼─────┐  ┌──────▼────┐  ┌───▼────────┐
                         │ PostgreSQL │  │  Resend   │  │  MTN MoMo  │
                         │  (data)    │  │  (email)  │  │ (payments) │
                         └────────────┘  └───────────┘  └────────────┘
```

**Backend layering** (strictly one direction):

```
api/routes/*   →  services/*      →  repositories/*   →  models/* (SQLAlchemy)
(HTTP + auth)     (business logic)   (DB access only)     (tables)
                        │
                        └── uses core/: security (JWT/bcrypt), momo (MTN client),
                            email (Resend), model (ML), exceptions (error types)
```

One router per domain: **auth**, **admin**, **payment**, **predict**.

## Directory map (key files)

### Frontend — `sukaalicheck/`

```
app/
  (auth)/
    login/page.tsx              # facility login (routes user by JWT scope)
    payment/page.tsx            # first-time plan selection + MoMo "approve on phone" poll
    change-password/page.tsx    # set password after payment
  (public)/
    page.tsx                    # landing page
    signup/page.tsx             # multi-step facility signup
  (app)/                        # authenticated facility area (bottom-nav shell)
    layout.tsx                  # auth guard (redirect by scope)
    dashboard/page.tsx          # stats + subscription status + "New prediction" CTA
    predict/page.tsx            # 6-step prediction form  (+ subscription gate)
    predict/result/[id]/        # risk result screen + printable PDF report
    records/                    # past screenings list + detail
    renew/page.tsx              # renew subscription (MoMo poll)
    profile/page.tsx            # facility info, subscription card, language, sign out
  admin/
    login/page.tsx              # admin login
    dashboard/page.tsx          # facility management + "Require MoMo payment" toggle
lib/
  api.ts                        # all typed fetch helpers to the backend
  schemas.ts                    # Zod schemas (login, prediction, signup, payment…)
  risk-engine.ts, mock.ts, utils.ts
stores/
  auth.ts                       # facility session (JWT + user in sessionStorage)
  admin-auth.ts                 # admin session
  language.ts                   # language preference (localStorage)
```

### Backend — `sukaali-check-backend/src/sukaali_check_backend/`

```
app.py                # FastAPI app: lifespan (seed admin/settings, load ML), routers, error handler
config.py             # pydantic-settings singleton (env vars, incl. MoMo config)
db/session.py         # engine, SessionLocal, Base, get_db()
api/
  deps.py             # scope-enforcing auth guards (get_current_facility, get_current_admin, …)
  routes/             # auth.py · admin.py · payment.py · predict.py
services/             # auth_service · admin_service · payment_service · predict_service
repositories/         # facility · specialist · otp_token · payment · prediction · app_setting
models/               # facility · specialist · otp_token · payment_record · prediction_record
                      # · admin · app_setting
core/
  security.py         # JWT encode/decode, bcrypt, OTP generation, scope constants
  momo.py             # MTN MoMo Collection client (token, request_to_pay, get_status)
  email.py            # Resend email wrappers (OTP, rejection, admin notification)
  model.py            # ML model load/access (joblib)
  exceptions.py       # DomainError hierarchy (NotFound/Conflict/Auth/Forbidden/Validation/…)
ml/OptimizedRFmodel.pkl   # trained Random Forest model
alembic/              # database migrations
scripts/provision_momo_sandbox.py   # one-time MoMo sandbox credential helper
```

## Core features (one line each — details in BUSINESS_LOGIC.md)

- **Auth & facility lifecycle** — `pending_approval → pending_payment → active`, enforced by four JWT scopes.
- **Signup & admin approval** — self-serve signup, admin approves and emails a one-time activation code (OTP).
- **Subscriptions & payments** — admin toggle chooses instant activation *or* real MTN MoMo mobile-money charge.
- **Prediction** — 6-step form → scikit-learn model → risk level, score, and contributing factors → printable report.
- **Records** — every screening is stored per-facility and browsable.
- **Admin portal** — approve/reject/unlock/delete facilities and control the payment mode.

## Running it

**Local development**
```bash
# Frontend
cd sukaalicheck && npm install && npm run dev        # http://localhost:3000

# Backend
cd sukaali-check-backend && uv sync
uv run alembic upgrade head                          # apply migrations
uv run sukaali-check-backend                         # http://localhost:8000  (Swagger at /docs)
```

**Production** — Docker Compose on a Digital Ocean droplet; a GitHub Actions workflow builds the
image, pushes to Docker Hub, and redeploys on the server. See **[DEPLOYMENT.md](DEPLOYMENT.md)**.
