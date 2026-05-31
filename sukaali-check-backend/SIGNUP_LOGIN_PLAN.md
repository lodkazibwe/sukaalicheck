# SukaaliCheck Backend — Signup / Login Flow Plan

## Overview

This document describes the full backend implementation plan for the facility signup and login flow. The frontend multi-step form (Facility → Specialist → Payment) currently submits nowhere. This plan wires it to a real backend with admin approval, OTP-based first login, payment, and password setup.

---

## Full User Journey

```
1. Facility submits signup form (steps 1 + 2: Facility + Specialist info)
         ↓
2. Backend saves application as PENDING_APPROVAL
   → Admin receives email notification
         ↓
3. Admin reviews specialist licence and approves in admin panel
   → System generates 6-digit OTP
   → OTP emailed to facility email address
   → Status → PENDING_PAYMENT
         ↓
4. Facility logs in with: facility_id + OTP
   → JWT issued with scope: "first_login"
   → Frontend redirects to Payment page
         ↓
5. Facility selects an activation plan:
     • Monthly    — UGX 70,000  / 30 days
     • Annual     — UGX 750,000 / 365 days
     • Camp Week  — UGX 100,000 / 5 consecutive days
                    (facility picks a start date from a calendar)
   Facility enters MTN MoMo number and submits
   → Phase 1: payment auto-succeeds immediately (no MoMo API)
   → PaymentRecord created (status=completed)
   → subscription_expires_at calculated from chosen plan
   → JWT issued with scope: "payment_done"
         ↓
6. Frontend redirects to Change Password page
   → Facility sets a real password
   → Status → ACTIVE
   → JWT issued with scope: "facility" (full access)
         ↓
7. Facility lands on Dashboard
```

---

## Activation Packages

| Plan | Price (UGX) | Duration | Notes |
|---|---|---|---|
| **Monthly** | 70,000 | 30 days from payment date | Renews manually |
| **Annual** | 750,000 | 365 days from payment date | Best value |
| **Camp Week** | 100,000 | 5 consecutive days | Facility picks a start date; expires end of day 5 |

**Phase 1 behaviour:** no MoMo API is called. Submitting the payment form immediately marks the record as `completed` and issues a `payment_done` JWT. The MoMo number is stored for reference.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | FastAPI |
| Server | Uvicorn |
| ORM | SQLAlchemy (sync) — see Concurrency note below |
| DB driver | psycopg3 (`psycopg[binary]`) |
| Migrations | Alembic |
| Auth | PyJWT (HS256) |
| Hashing | bcrypt |
| Email | fastapi-mail + Jinja2 HTML templates |
| Rate limiting | slowapi |
| Docs | Swagger UI at `/docs`, ReDoc at `/redoc` |
| Config | pydantic-settings (existing `config.py`) |

**Concurrency note:** Phase 1 uses sync SQLAlchemy with sync route handlers. This blocks a worker thread per request — same model as Spring Boot. Scale by running multiple Uvicorn workers (`--workers 4`) behind Nginx. Phase 2 may migrate to async SQLAlchemy + `asyncpg` once load justifies it. Don't mix sync and async in services — pick one lane and stay in it.

---

## Step 0 — Dependencies

```bash
cd sukaali-check-backend
uv add fastapi "uvicorn[standard]" sqlalchemy "psycopg[binary]" alembic \
       pydantic pydantic-settings pyjwt bcrypt python-multipart \
       fastapi-mail jinja2 slowapi
```

---

## Step 1 — Database Models

### `models/facility.py`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | server default `gen_random_uuid()` |
| `facility_id` | VARCHAR(20) UNIQUE | system-generated from sequence, e.g. `SKC-000001` |
| `facility_name` | VARCHAR(255) | |
| `facility_type` | VARCHAR(30) | hospital \| clinic \| health_centre \| herbal \| pharmacy |
| `ownership` | VARCHAR(30) | private \| government \| ngo \| faith_based |
| `district` | VARCHAR(100) | |
| `physical_address` | TEXT | |
| `facility_phone` | VARCHAR(30) | |
| `facility_email` | VARCHAR(255) UNIQUE | login identifier target for OTP |
| `password_hash` | VARCHAR(255) | NULL until change-password step |
| `failed_login_attempts` | INTEGER | default 0; reset on successful login |
| `locked_until` | TIMESTAMP | NULL unless temporarily locked |
| `status` | VARCHAR(30) | see status enum below |
| `plan_type` | VARCHAR(20) | monthly \| annual \| camp_week — set on activation |
| `subscription_expires_at` | TIMESTAMP | **mirror** of latest `PaymentRecord.plan_end_date` — never written directly; only via `facility_repo.set_plan()` |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | auto-updated via SQLAlchemy `onupdate=func.now()` |

**Status enum:**
```
pending_approval  → pending_payment  → active
                                     ↘ rejected
                                       suspended  (future)
```

**`facility_id` generation:** Use a Postgres sequence (`CREATE SEQUENCE facility_id_seq START 1`) and format as `SKC-{seq:06d}` in the service layer. Monotonic, collision-free, and useful for support ("SKC-000123 signed up first").

---

### `models/specialist.py`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `facility_id` | UUID FK → Facility | ON DELETE CASCADE |
| `specialist_name` | VARCHAR(255) | |
| `specialist_title` | VARCHAR(50) | medical_officer \| clinical_officer \| nurse \| midwife \| herbalist \| pharmacist \| other |
| `licence_number` | VARCHAR(100) | admin verifies this manually |
| `specialist_phone` | VARCHAR(30) | |
| `created_at` | TIMESTAMP | |

---

### `models/otp_token.py`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `facility_id` | UUID FK → Facility | |
| `token_hash` | VARCHAR(255) | bcrypt hash of the 6-digit OTP |
| `failed_attempts` | INTEGER | default 0; increment on each wrong guess |
| `expires_at` | TIMESTAMP | `now() + 24 hours` |
| `used_at` | TIMESTAMP | NULL until consumed |
| `created_at` | TIMESTAMP | |

**Brute-force protection:** after 5 failed attempts the token is invalidated (treated as used). Admin must re-approve to issue a new one. Re-approving a facility also invalidates all prior unused tokens for that facility.

---

### `models/payment_record.py`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `facility_id` | UUID FK → Facility | |
| `reference` | VARCHAR(50) UNIQUE | `SK-XXXXXX` (random) |
| `plan_type` | VARCHAR(20) | monthly \| annual \| camp_week |
| `momo_number` | VARCHAR(30) | stored for reference; no API call in Phase 1 |
| `amount` | INTEGER | derived from plan (70000 \| 750000 \| 100000) |
| `camp_start_date` | DATE | only for camp_week; facility-chosen start day |
| `plan_start_date` | DATE | date payment is confirmed |
| `plan_end_date` | DATE | start + 29d (monthly) \| +364d (annual) \| camp_start + 4d (camp_week) |
| `status` | VARCHAR(20) | pending \| completed \| failed |
| `provider_ref` | VARCHAR(100) | MoMo transaction ID (Phase 2) |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | auto-updated via SQLAlchemy `onupdate=func.now()` |

**Plan pricing constants (defined in `services/payment_service.py`):**
```python
PLAN_PRICES = {
    "monthly":   70_000,
    "annual":    750_000,
    "camp_week": 100_000,
}
```

> When pricing becomes per-facility or per-region, move this to a `plans` table.

---

### Alembic naming convention

Apply to `Base.metadata` in `db/session.py` so constraints get deterministic names (avoids painful future migrations):

```python
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
```

---

## Step 2 — Alembic Migrations

```bash
alembic init alembic
# edit alembic/env.py — import Base from db/session.py and Settings
alembic revision --autogenerate -m "initial_schema"
# Manually add to the migration: CREATE SEQUENCE facility_id_seq START 1
alembic upgrade head
```

---

## Step 3 — Pydantic Schemas

> All schemas use **Pydantic v2** syntax: `model_config = ConfigDict(from_attributes=True)` (not v1's `orm_mode`), and `@field_validator` (not `@validator`).

### `schemas/auth.py`
```python
class SignupRequest:
    # Step 1 — Facility
    facility_name, facility_type, ownership, district
    physical_address, facility_phone, facility_email
    # Step 2 — Specialist
    specialist_name, specialist_title, licence_number, specialist_phone

class SignupResponse:
    message: str
    facility_id: str   # e.g. "SKC-000001"

class LoginRequest:
    facility_id: str
    password: str      # OTP on first login; real password thereafter

class LoginResponse:
    access_token: str
    token_type: str    # "bearer"
    scope: str         # first_login | facility
    facility: FacilityOut

class ChangePasswordRequest:
    new_password: str   # min 8 chars, validated via @field_validator
    confirm_password: str

class FacilityOut:
    id, facility_id, facility_name, status, subscription_expires_at
```

### `schemas/admin.py`
```python
class FacilityListItem:
    id, facility_id, facility_name, district, status, created_at

class FacilityDetail(FacilityListItem):
    facility_type, ownership, physical_address
    facility_phone, facility_email
    specialist: SpecialistOut

class ApproveRequest:
    notes: str | None

class RejectRequest:
    reason: str
```

### `schemas/payment.py`
```python
class PlanType(str, Enum):
    monthly   = "monthly"
    annual    = "annual"
    camp_week = "camp_week"

class PlanOption:
    plan_type:      str
    label:          str
    amount:         int    # UGX
    duration_label: str    # "30 days" | "365 days" | "5 consecutive days"

class InitiatePaymentRequest:
    plan_type:       PlanType
    momo_number:     str
    camp_start_date: date | None  # required when plan_type == camp_week
                                  # must be today or a future date

class InitiatePaymentResponse:
    reference:       str
    plan_type:       str
    amount:          int
    plan_start_date: date
    plan_end_date:   date
    status:          str   # always "completed" in Phase 1

class ConfirmPaymentRequest:
    reference: str         # kept for Phase 2 webhook / manual admin confirm
```

---

## Step 4 — Core Utilities

### `core/exceptions.py`  (new file)

Services must **not** raise `HTTPException` directly — that couples them to HTTP and prevents reuse from CLI scripts or background jobs. Define domain exceptions here and map them to HTTP responses in `app.py`.

```python
class DomainError(Exception):
    """Base for all domain errors."""
    status_code: int = 500
    detail: str = "Internal error"

class NotFoundError(DomainError):
    status_code = 404

class ConflictError(DomainError):
    status_code = 409

class AuthError(DomainError):
    status_code = 401

class ForbiddenError(DomainError):
    status_code = 403

class ValidationError(DomainError):
    status_code = 422
```

A single exception handler in `app.py` catches `DomainError` and returns the appropriate JSON response.

### `core/security.py`  (extend existing stub)

```python
# Hashing
hash_password(plain: str) -> str
verify_password(plain: str, hashed: str) -> bool

# OTP
generate_otp() -> str          # 6-digit string via secrets
hash_otp(otp: str) -> str      # same as hash_password

# JWT scopes
SCOPE_FIRST_LOGIN  = "first_login"    # OTP accepted; gated to /payment + /auth/change-password
SCOPE_PAYMENT_DONE = "payment_done"   # payment confirmed; gated to /auth/change-password
SCOPE_FACILITY     = "facility"       # full authenticated access
SCOPE_ADMIN        = "admin"          # admin routes

# JWT
create_access_token(data: dict, scope: str, expires_delta: timedelta) -> str
decode_access_token(token: str) -> dict    # raises AuthError on bad/expired token
```

### `core/email.py`  (new file)

```python
# fastapi-mail connection config built from Settings
# All sends are invoked via FastAPI BackgroundTasks so SMTP outages
# don't fail the originating request.
send_admin_notification(facility_name, specialist_name, licence_number, facility_email)
send_otp_email(to_email, facility_name, otp)
```

HTML templates live in `templates/email/`:
- `admin_new_signup.html` — notifies admin of a new application
- `facility_otp.html` — sends OTP to the facility with expiry warning

**Failure handling:** wrap each send in try/except, log failures with structlog, and surface a flag on the response (e.g. `email_sent: false`) so the admin panel can offer a "resend" button. Never let an email failure leave the system in a half-state.

### `core/rate_limit.py`  (new file)

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Applied via decorator on routes:
#   @limiter.limit("10/minute")  on /auth/login
#   @limiter.limit("5/hour")     on /auth/signup
```

New env vars to add to `config.py` and `.env.example`:

```
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM=noreply@sukaalicheck.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_TLS=true
ADMIN_EMAIL=admin@sukaalicheck.com
```

---

## Step 5 — Repositories

One class per model, all take `db: Session`. No business logic — raw DB access only. **Repositories never raise domain exceptions** — they return `None`/empty lists and let services decide what's an error.

| File | Key methods |
|---|---|
| `repositories/facility.py` | `get_by_id`, `get_by_facility_id`, `get_by_email`, `create`, `update_status`, `set_password_hash`, `set_plan(facility_id, plan_type, subscription_expires_at)`, `increment_failed_attempts`, `reset_failed_attempts`, `list_by_status`, `next_facility_sequence_value` |
| `repositories/specialist.py` | `create`, `get_by_facility_id` |
| `repositories/otp_token.py` | `create`, `get_valid_token`, `invalidate_all_for_facility`, `mark_used`, `increment_failed_attempts` |
| `repositories/payment.py` | `create`, `get_by_reference`, `get_by_facility_id`, `update_status`, `get_active_record` |

---

## Step 6 — Services

> All services raise `core.exceptions.*` (domain errors), never `HTTPException`. The mapping to HTTP happens in `app.py`.

### `services/auth_service.py`

**`signup(db, data, background_tasks)`**
1. Check `facility_email` not already registered → `ConflictError` if exists
2. Get next sequence value from `facility_repo.next_facility_sequence_value()` → format as `SKC-{n:06d}`
3. `FacilityRepo.create(status=pending_approval, password_hash=None)`
4. `SpecialistRepo.create(...)`
5. `background_tasks.add_task(send_admin_notification, ...)`
6. Return `{ message, facility_id }`

**`login(db, facility_id, password)`**
1. Lookup Facility → `AuthError` if not found
2. If `locked_until` set and in the future → `ForbiddenError("Account temporarily locked")`
3. `status == pending_approval` → `ForbiddenError("Your application is under review")`
4. `status == rejected` → `ForbiddenError("Your application was not approved")`
5. `status == pending_payment`:
   - Find valid OtpToken (unused + not expired + failed_attempts < 5) → `AuthError` if none
   - `verify_password(password, otp_token.token_hash)`:
     - On fail: `OtpRepo.increment_failed_attempts(token_id)`; if attempts reach 5, mark token used. Raise `AuthError("Invalid OTP")`
     - On success: mark OTP used, issue JWT `scope=first_login`, expires 30 min
6. `status == active`:
   - `verify_password(password, facility.password_hash)`:
     - On fail: `FacilityRepo.increment_failed_attempts(facility_id)`; if >= 10 attempts in last hour, set `locked_until = now() + 15 min`. Raise `AuthError("Invalid credentials")`
     - On success: `FacilityRepo.reset_failed_attempts(facility_id)`, issue JWT `scope=facility`, expires per settings (60 min default)

**`change_password(db, facility_id, new_password, scope)`**
1. Validate `new_password` min 8 chars (handled by Pydantic `@field_validator`)
2. Hash new password
3. `FacilityRepo.set_password_hash(...)`
4. If status == `pending_payment` (i.e. scope is `payment_done`) → set `status=active`
   - **Do NOT touch `subscription_expires_at`** — it was already set correctly by `_complete_payment` during the payment step. Overwriting it here would break monthly and camp_week plans.
5. Issue JWT `scope=facility`

---

### `services/admin_service.py`

**`approve(db, facility_id, background_tasks)`**
1. Facility must be `pending_approval` → `ValidationError` otherwise
2. `OtpRepo.invalidate_all_for_facility(facility_id)`
3. `otp = generate_otp()`
4. `OtpRepo.create(facility_id, hash_otp(otp), expires_at=now()+24h)`
5. `FacilityRepo.update_status(facility_id, pending_payment)`
6. `background_tasks.add_task(send_otp_email, facility_email, facility_name, otp)`

**`reject(db, facility_id, reason)`**
1. `FacilityRepo.update_status(facility_id, rejected)`

---

### `services/payment_service.py`

**`get_plans() -> list[PlanOption]`**
Returns the three plan options with prices — called by `GET /api/v1/payment/plans` (no auth).

**`initiate(db, facility_id, plan_type, momo_number, camp_start_date)`**
1. Facility `status == pending_payment` → `ForbiddenError` otherwise
2. Check no existing `pending` or `completed` PaymentRecord → `ConflictError` if one exists
3. Validate plan-specific fields:
   - `camp_week`: `camp_start_date` must be provided and ≥ today → `ValidationError` if missing/past
4. Compute dates:
   ```
   plan_start = today
   plan_end:
     monthly   → plan_start + 29 days
     annual    → plan_start + 364 days
     camp_week → camp_start_date + 4 days   (5 inclusive days)
   ```
5. Lookup amount from `PLAN_PRICES[plan_type]`
6. Generate unique reference `SK-{6 random digits}`
7. `PaymentRepo.create(facility_id, reference, plan_type, momo_number, amount, camp_start_date, plan_start, plan_end)`
8. **Phase 1 — auto-succeed:** immediately call `_complete_payment(db, record)`
9. Return PaymentRecord with `status=completed`

**`_complete_payment(db, record)` (internal)**
1. `PaymentRepo.update_status(record.reference, completed)`
2. `FacilityRepo.set_plan(facility_id, plan_type, subscription_expires_at=plan_end)`  
   ← **single source of truth update** — only place `subscription_expires_at` is written
3. Issue JWT `scope=payment_done`, expires 30 min → returned to route handler

**`confirm(db, reference)`** *(Phase 2 — MoMo webhook / admin manual)*
1. Find PaymentRecord → `NotFoundError` if not found
2. Record `status` must be `pending` → `ValidationError` otherwise
3. Call `_complete_payment(db, record)`
4. Return updated record

---

## Step 7 — API Routes

Rate limits applied via `@limiter.limit(...)` decorators.

### Auth  (`/api/v1/auth`)

| Method | Path | Auth required | Rate limit | Action |
|---|---|---|---|---|
| `POST` | `/signup` | none | 5/hour/IP | Submit facility + specialist |
| `POST` | `/login` | none | 10/min/IP | OTP or password login |
| `POST` | `/change-password` | JWT (`first_login` or `payment_done`) | 10/min/IP | Set real password |
| `GET` | `/me` | JWT (`facility`) | — | Current facility info |

### Admin  (`/api/v1/admin`)

| Method | Path | Auth required | Action |
|---|---|---|---|
| `GET` | `/facilities` | JWT (`admin`) | List all (filter by status) |
| `GET` | `/facilities/{id}` | JWT (`admin`) | Facility + specialist detail |
| `POST` | `/facilities/{id}/approve` | JWT (`admin`) | Approve → send OTP |
| `POST` | `/facilities/{id}/reject` | JWT (`admin`) | Reject application |

### Payment  (`/api/v1/payment`)

| Method | Path | Auth required | Action |
|---|---|---|---|
| `GET`  | `/plans` | none | Return the three plan options with prices |
| `POST` | `/initiate` | JWT (`first_login`) | Select plan, create record, auto-succeed (Phase 1) |
| `POST` | `/confirm` | JWT (`admin`) | Manually mark payment completed (Phase 2 fallback) |

---

## Step 8 — FastAPI App Assembly (`app.py`)

```python
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from core.rate_limit import limiter
from core.exceptions import DomainError

app = FastAPI(
    title="SukaaliCheck API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Rate limiting
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# CORS — reads from settings.cors_origins
app.add_middleware(CORSMiddleware, allow_origins=..., allow_methods=["*"], allow_headers=["*"])

# Domain exception handler — single mapping from DomainError → HTTP
@app.exception_handler(DomainError)
async def domain_error_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail or str(exc)},
    )

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(status_code=429, content={"detail": "Too many requests"})

# Routers
app.include_router(auth_router,    prefix="/api/v1/auth",    tags=["Auth"])
app.include_router(admin_router,   prefix="/api/v1/admin",   tags=["Admin"])
app.include_router(payment_router, prefix="/api/v1/payment", tags=["Payment"])

# Swagger Bearer auth button configured in openapi_schema
```

---

## Step 9 — FastAPI Dependencies (`api/deps.py`)

```python
get_db()                         # yields SQLAlchemy Session
get_current_facility(token)      # decodes JWT, requires scope=facility
get_first_login_facility(token)  # requires scope=first_login
get_payment_done_facility(token) # requires scope=payment_done
get_current_admin(token)         # requires scope=admin
```

These four scope-checked dependencies are the **security perimeter**. Write pytest tests for them alongside the dependency code — don't wait until everything's wired.

**Admin bootstrap (Phase 1):** A seed script or env var `ADMIN_JWT_SECRET` generates a static admin token — no admin signup UI needed yet.

---

## Step 10 — Entry Point

```python
# src/sukaali_check_backend/__init__.py
def main():
    import uvicorn
    uvicorn.run("sukaali_check_backend.app:app", host="0.0.0.0", port=8000, reload=True)
```

```bash
uv run sukaali-check-backend
# Swagger UI → http://localhost:8000/docs
```

---

## Step 11 — Frontend Integration (post-backend)

Once the backend is live, update the frontend:

1. Set `NEXT_PUBLIC_API_BASE=http://localhost:8000` in `.env.local`
2. Create `sukaalicheck/lib/api.ts` with typed fetch helpers
3. **Signup page**: remove Step 3 (momoNumber) — payment now happens post-login. Form submits after Step 2.
4. **Login page**: on `scope=first_login` response → redirect to `/payment` instead of dashboard
5. **New `/payment` page**:
   - On load: `GET /api/v1/payment/plans` → display three plan cards
   - **Monthly card**: UGX 70,000 / 30 days
   - **Annual card**: UGX 750,000 / 365 days
   - **Camp Week card**: UGX 100,000 / 5 days → selecting this reveals a date picker; user picks the start date (today or future); backend computes end = start + 4 days
   - User enters MTN MoMo number, submits → `POST /api/v1/payment/initiate`
   - Response is immediate (`status=completed`) → store `payment_done` JWT → redirect to `/change-password`
6. **New `/change-password` page**: calls `POST /api/v1/auth/change-password`, then redirects to dashboard

---

## Implementation Order

| # | Task |
|---|---|
| 1 | `uv add` all dependencies (incl. `slowapi`) |
| 2 | `config.py` — add SMTP + ADMIN_EMAIL settings |
| 3 | `db/session.py` — wire engine + Base with NAMING_CONVENTION |
| 4 | `models/` — Facility, Specialist, OtpToken, PaymentRecord (with `updated_at` triggers + lockout columns) |
| 5 | Alembic init + first migration (manually add `CREATE SEQUENCE facility_id_seq`) + `alembic upgrade head` |
| 6 | `core/exceptions.py` — domain error hierarchy |
| 7 | `core/security.py` — hashing, OTP, JWT helpers |
| 8 | `core/email.py` — fastapi-mail + Jinja2 templates (with try/except per send) |
| 9 | `core/rate_limit.py` — slowapi Limiter |
| 10 | `repositories/` — four repo classes |
| 11 | `services/` — auth, admin, payment services (raise domain errors only) |
| 12 | `api/deps.py` — dependency functions **+ pytest tests for each** |
| 13 | `api/routes/` — auth, admin, payment routers (with rate-limit decorators + BackgroundTasks) |
| 14 | `app.py` — FastAPI assembly + CORS + Swagger + DomainError handler |
| 15 | `__init__.py` — uvicorn entry point in `main()` |

---

## Verification Checklist

```
□ uv run sukaali-check-backend  →  server starts, no import errors
□ GET  /docs                    →  Swagger shows all 10 routes
□ POST /api/v1/auth/signup      →  201, admin email queued via BackgroundTasks
□ POST /api/v1/auth/signup ×6 in an hour →  429 rate limited
□ POST /api/v1/admin/facilities/{id}/approve  →  200, OTP email to facility
□ POST /api/v1/auth/login (OTP) →  200, scope=first_login in JWT
□ POST /api/v1/auth/login (wrong OTP) ×5  →  token invalidated, requires re-approval
□ POST /api/v1/auth/login ×11 in a minute →  429 rate limited

□ GET  /api/v1/payment/plans    →  200, returns 3 plan options with prices
□ POST /api/v1/payment/initiate (plan=monthly)    →  200, status=completed, plan_end = today+29d
□ POST /api/v1/payment/initiate (plan=annual)     →  200, status=completed, plan_end = today+364d
□ POST /api/v1/payment/initiate (plan=camp_week, camp_start_date=<future>)  →  200, plan_end = start+4d
□ POST /api/v1/payment/initiate (plan=camp_week, camp_start_date=<past>)    →  422 validation error
□ scope=payment_done JWT returned immediately after initiate

□ POST /api/v1/auth/change-password  →  200, scope=facility in JWT
□ subscription_expires_at unchanged across change-password call (still = plan_end_date)
□ POST /api/v1/auth/login (password) →  200, scope=facility
□ POST /api/v1/auth/login (wrong password) ×10 →  account locked for 15 min
□ alembic upgrade head (clean DB)    →  no errors
□ facility_id format is SKC-000001, SKC-000002, ... (sequential)
```

---

## Design Decisions & Rationale

- **Sync SQLAlchemy** in Phase 1 — simpler mental model coming from Spring Boot; scale via Uvicorn workers. Revisit if/when load demands async.
- **`subscription_expires_at` mirrored on `Facility`** for fast reads, but written only via `facility_repo.set_plan()` — single source of update prevents drift.
- **Domain exceptions over `HTTPException` in services** — keeps services reusable from CLI/background jobs and testable without HTTP context.
- **BackgroundTasks for all emails** — SMTP outages can't break user-facing flows.
- **Postgres sequence for `facility_id`** — collision-free, monotonic, support-friendly.
- **Rate limits + OTP failed-attempt counter** — closes the obvious brute-force attack on a 6-digit code.
- **Alembic naming convention upfront** — avoids painful constraint renames in future migrations.

---

## Notes

- **PostgreSQL**: use a separate database (e.g. `sukaalicheck_py`) on the existing Postgres server — avoids schema conflicts with the Spring Boot service.
- **Phase 1 payments**: auto-succeed on submit — no MoMo API called. The MoMo number is stored so it can be used for real push-payment in Phase 2. Swap `_complete_payment` call timing in `payment_service.initiate()` to make this change: call it from the `/confirm` webhook instead of immediately.
- **MoMo API (Phase 2)**: wire Flutterwave or MTN Direct push-payment. Scaffold is ready in `payment_service.initiate()` — the auto-succeed block is the only thing replaced.
- **OTP expiry**: 24 hours, max 5 failed attempts before invalidation. Admin can re-approve to issue a fresh token.
- **Login lockout**: 10 failed password attempts in a rolling hour triggers a 15-minute lock via `locked_until`. Successful login resets the counter.
- **Admin identity**: Phase 1 uses a static admin JWT; Phase 2 adds a proper admin entity and login.
- **Future improvement — magic link instead of OTP**: the current "OTP-as-password" flow is three friction steps (find email → paste code → eventually set real password). A signed magic link (`/onboard?token=<jwt>`) in the approval email collapses login + payment landing into one click. Worth revisiting after Phase 1 ships.