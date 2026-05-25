# SukaaliCheck — Frontend

AI-assisted Diabetes type 2 risk predictor for clinics and herbal facilities in Uganda.

See [CLAUDE.md](./CLAUDE.md) for architecture, brand tokens, mobile-first rules, and the v2 TODO list.

## Running locally

```bash
npm install
npm run dev          # http://localhost:3000
```

**Demo credentials:** `sarah@greenleafherbal.ug` / `password`

## Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE` | Base URL of the Spring Boot backend (e.g. `https://api.sukaalicheck.ug`). Not yet wired — all API calls use stubs from `lib/mock.ts`. |

## Static export / SPA deployment

The app is built as a static export (`output: 'export'` in `next.config.ts`). After `npm run build` an `out/` folder is produced.

For client-side routing to work on direct URL access (e.g. refreshing `/predict/result/<id>`), configure your web server to serve `index.html` for all routes:

- **Nginx:** `try_files $uri $uri.html $uri/ /index.html;`
- **Capacitor / native wrapper:** client-side routing handles all navigation natively, no server config needed.

## Project structure

```
app/(auth)/login/         → /login
app/(app)/                → authenticated shell + bottom nav
  page.tsx                → / (dashboard)
  predict/page.tsx        → /predict
  predict/result/[id]/    → /predict/result/:id
  records/page.tsx        → /records
  profile/page.tsx        → /profile
lib/mock.ts               → single source of truth for stub data
lib/risk-engine.ts        → client-side risk score calculation (replace with API call in v2)
lib/schemas.ts            → Zod form schemas
stores/auth.ts            → Zustand auth store (sessionStorage)
```
