# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
uv sync                                      # install / sync dependencies
uv run sukaali-check-backend                 # start dev server on :8000 (reload=True)
uv run pytest                                # run tests
uv add <package>                             # add a dependency

# Alembic
uv run alembic upgrade head                  # apply all migrations
uv run alembic revision --autogenerate -m "description"  # generate migration from model changes
uv run alembic downgrade -1                  # roll back one revision
```

## Environment

Copy `.env.example` → `.env`. Required variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://user:pass@host:5432/db` |
| `JWT_SECRET` | HS256 signing secret |
| `CORS_ORIGINS` | JSON array of allowed origins |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | SMTP credentials (Gmail) |
| `ADMIN_EMAIL` | Where admin notifications are sent on new signups |

Optional: `JWT_EXPIRE_MINUTES` (default 60), `ENVIRONMENT` (default `development`), `MAIL_FROM`, `MAIL_SERVER`, `MAIL_PORT`, `MAIL_TLS`.

## Architecture

Layered: **route → service → repository → SQLAlchemy session**.

```
src/sukaali_check_backend/
  app.py             # FastAPI app, middleware, router registration
  config.py          # pydantic-settings, module-level `settings` singleton
  db/session.py      # engine, SessionLocal, Base (DeclarativeBase), get_db()
  models/            # ORM models (Facility, Specialist, OtpToken, PaymentRecord)
  schemas/           # Pydantic I/O schemas (auth.py, admin.py, payment.py)
  repositories/      # DB access — one class per model, no raw SQL
  services/          # Business logic (auth_service, admin_service, payment_service)
  api/
    deps.py          # FastAPI deps: get_db, scope-enforcing auth guards
    routes/          # auth.py, admin.py, payment.py — one router per domain
  core/
    security.py      # bcrypt hashing, JWT encode/decode, OTP generation
    exceptions.py    # DomainError hierarchy (NotFound/Conflict/Auth/Forbidden/Validation)
    email.py         # fastapi-mail wrappers (Jinja2 templates in templates/email/)
    rate_limit.py    # slowapi Limiter instance
```

### API routes

- `/api/v1/auth` — signup, login, change-password, me
- `/api/v1/admin` — facility list/detail/approve/reject (admin scope only)
- `/api/v1/payment` — plan options, initiate payment, confirm payment

Swagger UI at `/docs`; Bearer auth button is pre-wired.

### Facility lifecycle

```
signup → pending_approval
  ↓ (admin approves — sends OTP email)
pending_payment   [login with OTP → first_login scope JWT]
  ↓ (choose plan, initiate payment → payment_done scope JWT)
  ↓ (admin confirms payment → set password → active scope JWT)
active
```

Rejected applications get status `rejected`. Accounts lock for 15 min after 10 failed password attempts.

### Auth scopes (JWT `scope` claim)

| Scope | Issued when | Guards |
|---|---|---|
| `first_login` | OTP login succeeds (pending_payment) | `get_first_login_facility` |
| `payment_done` | Admin confirms payment before password set | `get_payment_done_facility` |
| `facility` | Full login (active account) | `get_current_facility` |
| `admin` | Admin login | `get_current_admin` |

### Key implementation details

- Facility IDs are auto-generated as `SKC-{seq:06d}` using a PostgreSQL sequence `facility_id_seq` (created in initial migration).
- `DomainError` subclasses are caught by a global exception handler in `app.py` and returned as `{"detail": "..."}` with the appropriate HTTP status.
- Rate limits: signup 5/hour, login 10/minute, change-password 10/minute (slowapi, keyed by IP).
- All models use `UUID` primary keys with `gen_random_uuid()` server default.
- `Base` in `db/session.py` defines a naming convention for constraints — Alembic autogenerate relies on this.
