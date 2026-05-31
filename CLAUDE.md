# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

```
sukaalicheckAll/
  sukaalicheck/          # Next.js 16 frontend (main app)
  sukaali-check-backend/ # Python 3.13 backend (early stage)
```

Frontend has its own detailed `sukaalicheck/CLAUDE.md` — read it before touching frontend code.

---

## Frontend (`sukaalicheck/`)

See `sukaalicheck/CLAUDE.md` for the full spec. Quick reference:

```bash
cd sukaalicheck
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Stack: Next.js 16.2.5 (App Router, static export), TypeScript strict, Tailwind v4, Zustand, TanStack Query, React Hook Form + Zod.

---

## Backend (`sukaali-check-backend/`)

Python 3.13, managed with **uv**.

```bash
cd sukaali-check-backend
uv sync          # install dependencies
uv run <cmd>     # run within the venv
```

Config is loaded from `.env` via pydantic-settings. Copy `.env.example` → `.env` and fill in:
- `DATABASE_URL` — PostgreSQL (psycopg3 driver: `postgresql+psycopg://...`)
- `JWT_SECRET` — replace the placeholder before any real use
- `CORS_ORIGINS` — JSON array, default allows `localhost:3000` and `localhost:5173`

The backend is in early scaffolding; only `config.py` and an empty `main()` exist. The frontend uses stub API routes under `sukaalicheck/app/api/` until the real backend is ready. When the backend is wired in, set `NEXT_PUBLIC_API_BASE` in the frontend's environment.
