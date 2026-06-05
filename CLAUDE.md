# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

```
sukaalicheckAll/
  sukaalicheck/          # Next.js 16 frontend (main app)
  sukaali-check-backend/ # Python 3.13 + FastAPI backend
  docker-compose.yml     # orchestrates frontend + backend + certbot
  DEPLOYMENT.md          # Digital Ocean deployment guide (Docker + GitHub Actions)
```

Each subdirectory has its own detailed `CLAUDE.md` — read it before touching code in that package.

---

## Frontend (`sukaalicheck/`)

See `sukaalicheck/CLAUDE.md` for the full spec. Quick reference:

```bash
cd sukaalicheck
npm run dev          # http://localhost:3000
npm run build        # production build (static export)
npm run lint
npx tsc --noEmit    # type check (no typecheck script)
```

Stack: Next.js 16.2.5 (App Router, static export), TypeScript strict, Tailwind v4, Zustand, TanStack Query, React Hook Form + Zod.

---

## Backend (`sukaali-check-backend/`)

See `sukaali-check-backend/CLAUDE.md` for the full spec. Quick reference:

```bash
cd sukaali-check-backend
uv sync                         # install dependencies
uv run sukaali-check-backend    # start dev server on :8000 (auto-reload)
uv run pytest                   # run tests
```

FastAPI app with PostgreSQL (psycopg3), SQLAlchemy, Alembic migrations, JWT auth, and fastapi-mail. Swagger UI at `/docs`. Copy `.env.example` → `.env`; required: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `MAIL_USERNAME`, `MAIL_PASSWORD`.

---

## Deployment

Production runs on a Digital Ocean droplet via Docker Compose. GitHub Actions (push to `main`) builds the frontend image, pushes to Docker Hub, and SSHs into the droplet to pull and restart. See `DEPLOYMENT.md` for the full setup guide and required GitHub secrets.

`NEXT_PUBLIC_API_BASE` is a build-time env var baked into the static JS bundle — it cannot be changed at runtime.
