# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

AI-assisted Diabetes type 2 risk predictor tool for clinics and herbal facilities in Uganda. Staff sign in, enter a patient's data, get a risk prediction, generate a PDF report, and save the record. The backend is a separate Spring Boot service; this repo is the Next.js frontend that will also be wrapped as a mobile app later.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build (also triggers static export)
npm run lint     # run ESLint
```

There is no `typecheck` or `test` script. To type-check manually: `npx tsc --noEmit`.

## Project status

**v1 scope (current):** Login, Dashboard, New Prediction, Risk Result, Records list. End-to-end flow with client-side risk computation and sessionStorage result passing.

**Out of scope until explicitly requested:** billing/payments, device binding, admin dashboard, real PDF generation, real ML model integration, SMS reports.

Do not scaffold out-of-scope features. If a task seems to require one, stop and ask.

---

## Stack

- **Next.js 16.2.5** (App Router). Static export (`output: 'export'`) is production-only — dev server runs as a normal Next.js app.
- TypeScript strict mode
- Tailwind CSS v4 (CSS-first config in `app/globals.css`)
- shadcn/ui primitives: Button, Input, Label, Select, Slider, Card, Badge, Form
- **sonner** for toasts (`<Toaster>` mounted in `components/providers.tsx`) — not shadcn Toast
- React Hook Form + Zod for forms
- Zustand for auth state and language preference
- TanStack Query (QueryClientProvider in `components/providers.tsx`)
- lucide-react for icons

No other UI libraries. No CSS-in-JS. No Server Actions (static export, Spring Boot backend).

---

## Mobile-first

Design for **360–414px width as the primary target.** `allowedDevOrigins` in `next.config.ts` is set to `192.168.10.115` for LAN testing from a real Android device.

- Tap targets ≥ 44px
- Forms stack single-column on mobile, two-column from `md:` up
- No hover-only affordances — everything must work with tap
- Sticky bottom CTA on long forms
- Bottom nav on mobile (Home / New / Records / Profile)

---

## Brand tokens

Defined as CSS variables in `app/globals.css`. **Always use the tokens, never hardcode hex.**

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
--risk-intermediate: #F2A623;
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

```
app/
  (auth)/login/page.tsx          # login screen
  (public)/page.tsx              # landing page
  (public)/signup/page.tsx       # facility signup (multi-step)
  (app)/
    layout.tsx                   # auth guard + bottom nav shell
    dashboard/page.tsx           # dashboard
    predict/
      page.tsx                   # 6-step prediction form (client)
      result/[id]/
        page.tsx                 # server wrapper (generateStaticParams)
        result-client.tsx        # client component reading sessionStorage
    records/
      page.tsx                   # records list
      [id]/page.tsx              # record detail (placeholder)
    profile/page.tsx             # profile screen
  globals.css                    # Tailwind v4 theme + CSS variables
  layout.tsx                     # root layout (fonts, Providers)

components/
  ui/                            # shadcn primitives
  bottom-nav.tsx                 # bottom navigation bar
  risk-badge.tsx                 # risk level badge
  providers.tsx                  # QueryClientProvider + Toaster

lib/
  schemas.ts                     # Zod schemas (loginSchema, predictionSchema, signupSchema)
  mock.ts                        # seed data + types (RiskLevel, Staff, PredictionRecord)
  risk-engine.ts                 # computeRisk(), bmi(), bmiCategory()
  utils.ts                       # cn(), patientId()

stores/
  auth.ts                        # Zustand: token + user in sessionStorage
  language.ts                    # Zustand: lang preference in localStorage
```

`lib/api.ts` is planned but does not exist yet. All data flows are local (sessionStorage/mock) for v1.

---

## Key architectural patterns

### Prediction data flow
The prediction form (`predict/page.tsx`) computes the risk client-side via `computeRisk()` from `lib/risk-engine.ts`, stores the result in `sessionStorage` as `pred_${id}`, then navigates to `/predict/result/${id}`. The result page reads back from sessionStorage. No API call is involved in v1.

### Static export + dynamic routes
`result/[id]/page.tsx` exports `generateStaticParams` returning an empty array so the static export doesn't fail. The actual data loading is in `result-client.tsx` which runs client-side.

### Auth guard
`app/(app)/layout.tsx` calls `hydrate()` on mount, waits for `isHydrated`, then redirects to `/login` if no token. Show a spinner while hydrating — never flash protected content.

### Multi-step form
`predict/page.tsx` uses a single `useForm` instance shared across 6 steps. Per-step validation is triggered with `form.trigger(fields)` before advancing. Step metadata lives in `STEP_META` at the top of the file.

---

## Risk engine (`lib/risk-engine.ts`)

`computeRisk()` uses a weighted point-scoring model (not a simple glucose threshold). Contributing factors and weights:

| Factor | Points |
|---|---|
| Age ≥ 55 | +15 |
| Age 45–54 | +8 |
| BMI ≥ 30 (obese) | +15 |
| BMI 25–29 (overweight) | +8 |
| Family history of diabetes | +15 |
| Hypertension | +10 |
| Low physical activity | +10 |
| Intermediate activity | +3 |
| Poor diet (≤ 3/10) | +8 |
| Excellent diet (≥ 8/10) | −5 |
| Blood glucose ≥ 126 mg/dL | +20 |
| Blood glucose 100–125 mg/dL | +10 |

Score thresholds: < 35 → low, 35–59 → intermediate, ≥ 60 → high.

**This is a placeholder model — do not represent it as clinically validated.**

---

## Critical product rules

### Disclaimer is mandatory and exact

The risk result screen must show this disclaimer directly below the risk badge, in a visible amber-tinted card:

> "This is a screening estimate, not a medical diagnosis. Refer the patient to a qualified clinician for proper evaluation and care."

Do not paraphrase. Do not move it below the fold. Do not allow it to be dismissed.

For high-risk results, additionally show a red callout above the action buttons:

> "We strongly recommend immediate clinical referral."

### Copy is staff-facing, not patient-facing

The user is clinic staff entering data **for** a patient. Use "Enter the patient's details," "the patient's age," etc. Never "your details" or "your age."

### "Refer to clinic" is a first-class action

The result screen has three actions: Download PDF, Refer to clinic, Save and finish. "Refer to clinic" is a stub for now (toast message), but it must be visible alongside the PDF button — not hidden in a menu.

### No localStorage for auth

Auth token lives in Zustand + `sessionStorage`. Never `localStorage`. Language preference (`app_lang`) is the only thing allowed in `localStorage`.

---

## API contract (v1 stubs)

Stubbed Next.js route handlers under `app/api/*` return mock data from `lib/mock.ts`. When the real Spring Boot backend is ready, set `NEXT_PUBLIC_API_BASE` and implement helpers in `lib/api.ts`.

```
POST /api/auth/login
  body: { facilityId, password }
  returns: { token, facility: { id, name, plan, subscriptionStatus, expiresAt } }

POST /api/predict
  body: { age, sex, weightKg, heightCm, familyHistory, hypertension,
          activityLevel, dietScore, glucoseMgDl }
  returns: { predictionId, riskLevel: 'low'|'intermediate'|'high', riskScore: 0-100 }

GET /api/records?search=&risk=&range=
  returns: { records: [...], total }

GET /api/stats/today
  returns: { predictionsToday, predictionsThisWeek, highRiskThisWeek }
```

---

## Form fields (canonical list)

Keep in sync with `lib/schemas.ts`.

| Section | Field | Type | Constraints |
|---|---|---|---|
| Patient information | Age | number | 18–100 |
| Patient information | Sex | toggle | Male / Female |
| Body measurements | Weight (kg) | number | 0–300 |
| Body measurements | Height (cm) | number | 0–220 |
| Body measurements | BMI | read-only | auto: weight / (height/100)² |
| Medical history | Family history of diabetes | yes/no toggle | yes / no |
| Medical history | Hypertension | yes/no toggle | yes / no |
| Lifestyle | Physical activity level | segmented | low / intermediate / high |
| Lifestyle | Diet quality score | slider | 1–10, default 5 |
| Blood test | Blood glucose (mg/dL) | number | 0–2000, optional |

---

## Coding conventions

- TypeScript strict, no `any`. If a third-party type is missing, narrow it locally.
- Functional components only. Server components by default; `"use client"` only when necessary.
- Co-locate component-specific subcomponents in the same file. Promote to `components/` only when reused.
- One default export per file. Named exports for hooks and utilities.
- Tailwind classes ordered: layout → spacing → typography → color → state.
- Use `cn()` from `lib/utils.ts` for conditional classes.
- Zod schemas in `lib/schemas.ts`. Infer types from schemas — never duplicate.
- API calls go through `lib/api.ts` helpers when it exists. No inline `fetch` in components.
- Use `toast()` from `sonner` for notifications, not shadcn Toast.

---

## Working with Claude Code

- Build screen by screen. Stop after each major screen and let the user review.
- Before adding any dependency, ask. The stack above is the full list.
- Prefer extending existing components over creating new ones.
- After any change to form fields, update `lib/schemas.ts` and the table above.
- Run `npm run lint` and `npx tsc --noEmit` before declaring a task done.

---

## TODO for v2 (do not build yet)

- Real ML model integration
- PDF report generation (Spring Boot / iText)
- Billing: MTN MoMo + Airtel Money via Flutterwave
- Subscription gating middleware
- Device binding and concurrent session limits
- Admin dashboard
- Recommendations pages (diet, physical activity)
- SMS report delivery
- Audit log viewer
- Luganda translations (toggle exists, only English wired)
- Consent capture screen
