# CLAUDE.md
# SukaaliCheck — Frontend

AI-assisted diabetes risk screening tool for clinics and herbal facilities in Uganda. Staff sign in, enter a patient's data, get a risk prediction, generate a PDF report, and save the record. The backend is a separate Spring Boot service; this repo is the Next.js frontend that will also be wrapped as a mobile app later.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build
npm run start    # serve production build
npm run lint     # run ESLint
```

## Project status

**v1 scope (current):** Login, Dashboard, New Prediction, Risk Result, Records list. End-to-end flow with stubbed API routes.

**Out of scope until explicitly requested:** Signup, billing/payments, device binding, admin dashboard, real PDF generation, recommendations pages (diet/exercise), real ML model integration, SMS reports.

Do not scaffold out-of-scope features. If a task seems to require one, stop and ask.

---

## Stack

- **Next.js 16.2.5**  (App Router, `output: 'export'` — static export)
- TypeScript strict mode
- Tailwind CSS v4 (CSS-first config in `globals.css`)
- shadcn/ui (only what we use: Button, Input, Label, Select, Slider, Card, Badge, Form, Toast)
- React Hook Form + Zod for forms
- Zustand for auth state (token in `sessionStorage`, hydrate on mount)
- TanStack Query for data fetching
- lucide-react for icons
- Inter via `next/font`

No other UI libraries. No CSS-in-JS. No Server Actions (static export, Spring Boot backend).

---

## Mobile-first

This will be wrapped as a native app (Expo or Capacitor — TBD). Design for **360–414px width as the primary target.**

- Tap targets ≥ 44px
- Forms stack single-column on mobile, two-column from `md:` up
- No hover-only affordances — everything must work with tap
- Sticky bottom CTA on long forms
- Bottom nav on mobile (Home / New / Records / Profile)
- Test on a real Android device, not just Chrome devtools

---

## Brand tokens

Defined as CSS variables in `app/globals.css` and wired into Tailwind v4's theme. **Always use the tokens, never hardcode hex.**

```css
--brand-green: #1FA85C;
--brand-green-dark: #178A4A;
--brand-green-50: #E8F7EE;
--brand-red: #E63946;
--brand-red-50: #FCEBEC;
--surface: #FFFFFF;
--surface-muted: #F4F6F8;
--border: #E5E7EB;
--text-primary: #1A1A1A;
--text-secondary: #5F6B7A;
--risk-low: #1FA85C;
--risk-moderate: #F2A623;
--risk-high: #E63946;
```

**Visual rules:**
- Cards: 12px radius. Inputs/buttons: 8px radius.
- One subtle shadow allowed on the result card. No other shadows.
- No gradients. No glow. No neon.
- Sentence case on all labels and headings.
- Primary action color is brand green. Red is for high-risk and destructive actions only.

---

## Directory layout
app/
(auth)/login/page.tsx
(app)/
layout.tsx              # auth-gated shell with bottom nav
page.tsx                # dashboard
predict/
page.tsx              # form
result/[id]/page.tsx  # risk result
records/
page.tsx              # list
[id]/page.tsx         # detail (placeholder)
api/                      # stub routes for v1
auth/login/route.ts
predict/route.ts
records/route.ts
stats/today/route.ts
globals.css
components/
ui/                       # shadcn primitives
layout/                   # AppShell, BottomNav, TopBar
prediction/               # form sections, RiskBadge, Disclaimer
lib/
schemas.ts                # Zod schemas
mock.ts                   # seed data — single source of truth for stubs
api.ts                    # fetch helpers, reads NEXT_PUBLIC_API_BASE
utils.ts                  # cn(), bmi(), formatters
stores/
auth.ts                   # Zustand

---

## Critical product rules

These are non-negotiable. They affect real users and real medical outcomes.

### Disclaimer is mandatory and exact

The risk result screen must show this disclaimer directly below the risk badge, in a visible amber-tinted card:

> "This is a screening estimate, not a medical diagnosis. Refer the patient to a qualified clinician for proper evaluation and care."

Do not paraphrase. Do not move it below the fold. Do not allow it to be dismissed.

For high-risk results, additionally show a red callout above the action buttons:

> "We strongly recommend immediate clinical referral."

### Copy is staff-facing, not patient-facing

The user is clinic staff entering data **for** a patient. Use "Enter the patient's details," "the patient's age," etc. Never "your details" or "your age."

### "Refer to clinic" is a first-class action

The result screen has three actions: Download PDF, Refer to clinic, Save and finish. "Refer to clinic" is a stub for now (toast message), but it must be visible alongside the PDF button — not hidden in a menu. The right action must be one tap away.

### No localStorage for auth

Auth token lives in Zustand + `sessionStorage`. Never `localStorage`. Hydrate on mount.

---

## API contract (v1 stubs)

All endpoints stubbed under `app/api/*` returning mock data from `lib/mock.ts`. When the real Spring Boot backend is ready, swap by setting `NEXT_PUBLIC_API_BASE` and updating the helpers in `lib/api.ts`.

POST /api/auth/login
body: { facilityId, password }
returns: { token, facility: { id, name, plan, subscriptionStatus, expiresAt } }
POST /api/predict
body: { age, sex, weightKg, heightCm, familyHistory, hypertension,
activityLevel, dietScore, glucoseMgDl }
returns: { predictionId, riskLevel: 'low'|'moderate'|'high', riskScore: 0-100 }
GET /api/records?search=&risk=&range=
returns: { records: [...], total }
GET /api/stats/today
returns: { predictionsToday, predictionsThisWeek, highRiskThisWeek }

**Mock prediction logic (deterministic, glucose-driven):**
- glucose ≥ 126 → high
- glucose 100–125 → moderate
- glucose < 100 → low

This is a placeholder so the UI can be wired before the real model exists. Do not pretend it's accurate.

---

## Form fields (canonical list)

The prediction form must include exactly these fields, in this order, with these constraints. Keep this list in sync with `lib/schemas.ts`.

| Section | Field | Type | Constraints |
|---|---|---|---|
| Language | Language | segmented | English / Luganda |
| Patient information | Age | number | 1–120 |
| Patient information | Sex | select | Male / Female |
| Body measurements | Weight (kg) | number | 20–250, 1 decimal |
| Body measurements | Height (cm) | number | 80–220, 1 decimal |
| Body measurements | BMI | read-only | auto: weight / (height/100)² |
| Medical history | Family history of diabetes | select | Yes / No |
| Medical history | Hypertension | select | Yes / No |
| Lifestyle | Physical activity level | select | Low / Moderate / High |
| Lifestyle | Diet quality score | slider | 0–10, default 5 |
| Blood test | Blood glucose (mg/dL) | number | 40–500, 1 decimal |

---

## Coding conventions

- TypeScript strict, no `any`. If a third-party type is missing, narrow it locally.
- Functional components only. No class components.
- Server components by default; mark client components with `"use client"` only when necessary (forms, interactivity, Zustand).
- Co-locate component-specific subcomponents in the same folder. Promote to `components/` only when reused.
- One default export per file. Named exports for hooks and utilities.
- Tailwind classes ordered: layout → spacing → typography → color → state.
- Use `cn()` from `lib/utils.ts` for conditional classes.
- Zod schemas in `lib/schemas.ts`. Infer types from schemas — never duplicate.
- API calls go through `lib/api.ts` helpers. No inline `fetch` in components.

---

## Working with Claude Code

- Build screen by screen. Stop after each major screen and let me review.
- Before adding any dependency, ask. The stack above is the full list.
- Prefer extending existing components over creating new ones.
- If you find yourself reaching for a feature listed under "Out of scope," stop and ask.
- After any change to form fields, update `lib/schemas.ts` and the table in this file.
- Run `pnpm typecheck` and `pnpm lint` before declaring a task done. Fix what you break.

---

## TODO for v2 (do not build yet)

- Real ML model integration (currently glucose-threshold mock)
- PDF report generation (Spring Boot side, iText/OpenPDF)
- Billing: MTN MoMo + Airtel Money via Flutterwave
- Subscription gating middleware
- Device binding and concurrent session limits
- Admin dashboard (facilities, revenue, usage)
- Recommendations pages (diet, physical activity)
- SMS report delivery
- Audit log viewer
- Luganda translations (UI strings; the toggle exists but only English is wired)
- Consent capture screen (data protection compliance)

---
