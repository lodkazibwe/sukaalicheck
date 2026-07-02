# SukaaliCheck — Business Logic Reference

A code-level walkthrough of how the system's business rules work, with the files and snippets that
implement them. Paths are relative to the repo root. For the big picture first, read
**[OVERVIEW.md](OVERVIEW.md)**.

Backend code lives under `sukaali-check-backend/src/sukaali_check_backend/` (abbreviated below as
`…/`). Frontend code lives under `sukaalicheck/`.

---

## 1. Facility lifecycle & authentication

A facility moves through a strict state machine, and every JWT carries a **scope** that says which
stage the holder is in. This is the backbone everything else hangs off.

```
signup ─▶ pending_approval
             │  (admin approves → OTP emailed)
             ▼
        pending_payment ──(OTP login)──▶ scope: first_login
             │  (pays / auto-activated → password_done)
             ▼                            scope: payment_done
          (set password)
             ▼
          active ─────────(normal login)─▶ scope: facility
```

**The four scopes** — `…/core/security.py`:

```python
SCOPE_FIRST_LOGIN = "first_login"   # logged in with OTP, must pay
SCOPE_PAYMENT_DONE = "payment_done" # paid, must set a password
SCOPE_FACILITY = "facility"         # fully active account
SCOPE_ADMIN = "admin"               # admin portal
```

**Scope enforcement** — every protected route depends on a guard in `…/api/deps.py`:

```python
def _require_scope(token: str, *allowed_scopes: str) -> dict:
    payload = decode_access_token(token)
    scope = payload.get("scope")
    if scope not in allowed_scopes:
        raise ForbiddenError(f"Insufficient scope. Required: {allowed_scopes}, got: {scope}")
    return payload

def get_current_facility(credentials=Depends(bearer_scheme)) -> dict:
    return _require_scope(credentials.credentials, SCOPE_FACILITY)
```

**Login routes users by scope** — `…/services/auth_service.py` returns the right scope depending on
account state (locked, pending approval, rejected, pending payment, or active). The active-login
branch also enforces the **account lockout** rule (10 failed attempts → locked 15 minutes):

```python
if facility.status == "active":
    if not facility.password_hash or not verify_password(password, facility.password_hash):
        new_count = facility_repo.increment_failed_attempts(facility.facility_id)
        if new_count >= 10:
            facility_repo.set_locked_until(facility.facility_id,
                                           datetime.utcnow() + timedelta(minutes=15))
        raise AuthError("Invalid credentials")
    facility_repo.reset_failed_attempts(facility.facility_id)
    token = create_access_token({"facility_id": facility.facility_id},
                                scope=SCOPE_FACILITY, ...)
```

**Frontend side.** The session lives in `sukaalicheck/stores/auth.ts` (Zustand, backed by
`sessionStorage` — never `localStorage`). The login page redirects based on the returned scope, and
the authenticated area's guard (`sukaalicheck/app/(app)/layout.tsx`) bounces anyone whose scope
isn't `facility`:

```tsx
// app/(app)/layout.tsx
if (!token || scope !== "facility") {
  if (scope === "first_login") router.replace("/payment");
  else if (scope === "payment_done") router.replace("/change-password");
  else router.replace("/login");
}
```

Facility model: `…/models/facility.py` (`status`, `plan_type`, `subscription_expires_at`,
`failed_login_attempts`, `locked_until`, …).

---

## 2. Signup → admin approval → activation code (OTP)

**Signup** — `…/services/auth_service.py::signup`. A human-readable facility ID is generated from
district / type / ownership codes plus a sequence, e.g. `KLA-CLI-PR-001`:

```python
def _build_facility_id(district, facility_type, ownership, seq) -> str:
    dist  = _DISTRICT_CODES.get(district.lower(), district[:3].upper())
    ftype = _TYPE_CODES.get(facility_type.lower(), facility_type[:3].upper())
    own   = _OWNERSHIP_CODES.get(ownership.lower(), ownership[:2].upper())
    return f"{dist}-{ftype}-{own}-{seq:03d}"
```

The new facility starts as `pending_approval`, and an admin is emailed a notification
(`…/core/email.py::send_admin_notification`, Resend HTTP API).

**Approval** — `…/services/admin_service.py::approve` flips the facility to `pending_payment`,
generates a 6-digit OTP, stores it **hashed** (`…/models/otp_token.py`), and emails it to the
facility. The facility then "logs in" with that OTP to obtain a `first_login` token.

```python
otp = generate_otp()
otp_repo.create(facility.id, hash_otp(otp), datetime.utcnow() + timedelta(hours=24))
facility_repo.update_status(facility.facility_id, "pending_payment")
background_tasks.add_task(send_otp_email, to_email=facility.facility_email, otp=otp, ...)
```

Rejection (`admin_service.reject`) sets status `rejected` + a reason and emails the applicant.

---

## 3. Subscriptions & payments  *(the most involved area)*

Payment is **admin-gated**. An admin switch decides, at runtime, whether subscriptions/renewals are
**activated instantly** (no charge) or go through a **real MTN MoMo mobile-money charge**.

### 3a. The admin toggle (runtime setting)

Settings are stored as key/value rows so they can change without a redeploy —
`…/models/app_setting.py`, `…/repositories/app_setting.py`:

```python
PAYMENT_ENABLED_KEY = "payment_enabled"   # value "true" / "false"; defaults to "false"
```

`…/services/admin_service.py` reads/writes it, and **refuses to enable** payments unless MoMo
credentials are configured (so the toggle can't switch on a broken flow):

```python
def set_payment_enabled(db, enabled: bool) -> bool:
    if enabled and not (settings.momo_subscription_key
                        and settings.momo_api_user and settings.momo_api_key):
        raise ValidationError("Configure MoMo credentials before enabling payments")
    AppSettingRepository(db).set(PAYMENT_ENABLED_KEY, "true" if enabled else "false")
    return enabled
```

Admin routes: `GET/POST /api/v1/admin/settings/payment-enabled` (`…/api/routes/admin.py`). The
admin dashboard renders a toggle card (`sukaalicheck/app/admin/dashboard/page.tsx`).

### 3b. The core branch — instant vs MoMo

`…/services/payment_service.py::initiate` (first-time) and `::renew` (existing facility) share the
same shape. After validating and computing the plan dates, they branch on the flag:

```python
def _payment_enabled(db: Session) -> bool:
    return AppSettingRepository(db).get(PAYMENT_ENABLED_KEY, "false") == "true"

# inside initiate():
if _payment_enabled(db):
    # MoMo path: charge first (so a provider failure leaves no orphan record), then return "pending"
    momo_ref = momo.request_to_pay(amount=amount, external_id=reference,
                                   msisdn=momo_number, payer_message=..., payee_note=...)
    record = payment_repo.create(status="pending", provider_ref=momo_ref, **common)
    return InitiatePaymentResponse(..., status="pending", access_token=None)

record = payment_repo.create(status="pending", **common)   # auto path
token = _complete_payment(db, record)                       # grants subscription immediately
return InitiatePaymentResponse(..., status="completed", access_token=token)
```

`_complete_payment` = **`_apply_subscription`** (mark record completed + set the facility's
`plan_type` / `subscription_expires_at`) **plus** issuing the `payment_done` token. Renewals reuse
`_apply_subscription` but keep the facility scope.

**One discriminated response.** Because both paths return the same object with a `status` field
(`"completed"` carries the token/facility inline; `"pending"` does not), the frontend needs no
separate "is payment on?" query — it just reacts to `status`.

### 3c. Async confirmation by polling

MoMo's RequestToPay is asynchronous (the user approves on their phone). When `status:"pending"`, the
frontend polls a status endpoint that asks MoMo for the outcome —
`…/services/payment_service.py::check_first_login_status` (and `check_renew_status`):

```python
result = momo.get_status(record.provider_ref)
momo_status = result.get("status")          # PENDING | SUCCESSFUL | FAILED
if momo_status == "SUCCESSFUL":
    token = _complete_payment(db, record)
    return PaymentStatusResponse(status="completed", access_token=token, scope=SCOPE_PAYMENT_DONE)
if momo_status == "FAILED":
    payment_repo.mark_failed(record.reference, result.get("reason") or "Payment failed")
    return PaymentStatusResponse(status="failed", reason=...)
return PaymentStatusResponse(status="pending")
```

Routes: `GET /api/v1/payment/status/{reference}` and `GET /api/v1/payment/renew/status/{reference}`.
The flag is only read by `initiate`/`renew`, so a payment already in flight always resolves — turning
the toggle off mid-flight doesn't strand it. The admin `POST /payment/confirm` is a manual
force-complete fallback.

### 3d. The MoMo client

`…/core/momo.py` — a synchronous `httpx` client that mirrors the email module's pattern:

- `_get_token()` — OAuth token via Basic auth, **cached** in-memory until ~60s before expiry.
- `request_to_pay(...)` — POSTs the charge with a generated `X-Reference-Id` (returned and stored as
  the payment's `provider_ref`).
- `get_status(momo_ref)` — polls the transaction.
- `_normalize_msisdn(...)` — turns `+256 772 123 456` / `0772…` into a bare `2567…` MSISDN.

Sandbox vs production is entirely **config** (`…/config.py`): `momo_target_environment`,
`momo_currency` (sandbox `EUR` / Uganda `UGX`), `momo_base_url`, and the three credentials. Sandbox
credentials are generated once with `scripts/provision_momo_sandbox.py`.

### 3e. Renewal date math

`renew` stacks the new period onto the remaining subscription when it's still valid, otherwise from
today:

```python
current_expiry = facility.subscription_expires_at.date() if facility.subscription_expires_at else None
base = current_expiry if current_expiry and current_expiry > today else today
# monthly → base + 29 days, annual → base + 364 days, camp_week → camp_start_date + 4 days
```

### 3f. Frontend payment UX

`sukaalicheck/app/(auth)/payment/page.tsx` (first-time) and
`sukaalicheck/app/(app)/renew/page.tsx` (renewal) call `initiatePayment` / `renewSubscription`
(`sukaalicheck/lib/api.ts`). On `status:"completed"` they proceed immediately; on `status:"pending"`
they show an **"Approve on your phone"** screen that polls every 3s (≈90s cap, then a manual
"Check again"), advancing on success or showing the failure reason.

---

## 4. Prediction flow

**Frontend** — `sukaalicheck/app/(app)/predict/page.tsx` is a single 6-step form (`STEP_META`
defines each step's fields; validation is triggered per step before advancing). The page is
**gated by subscription** — an expired facility sees a renew prompt instead of the form:

```tsx
const staff = user ?? MOCK_STAFF;
const days = staff.subscriptionExpiresAt ? daysUntil(staff.subscriptionExpiresAt) : -1;
const subscriptionExpired = staff.subscriptionStatus === "expired" || days <= 0;
// if (subscriptionExpired) → render "Subscription expired" card linking to /renew
```

**Backend** — `POST /api/v1/predict` → `…/services/predict_service.py`. It builds the feature vector,
runs the scikit-learn model, derives a 0–100 score, computes human-readable contributing factors,
and persists the record:

```python
features = np.array([[data.age, round(bmi, 2), _PHYSICAL_ACTIVITY[data.physical_activity],
                      _YES_NO[data.family_history_diabetes], _YES_NO[data.hypertension],
                      _SEX[data.sex], data.blood_glucose or 0.0, data.diet_quality]])
predicted_class = int(model.predict(features)[0])
probabilities = model.predict_proba(features)[0]     # [P(low), P(inter), P(high)]
risk_level = _CLASS_LABELS.get(predicted_class, "low")
risk_score = max(0, min(100, round(probabilities[1]*50 + probabilities[2]*100)))
```

The model (`…/ml/OptimizedRFmodel.pkl`, a Random Forest) is loaded once at startup —
`…/core/model.py::init_model` is called from the app lifespan in `…/app.py`. Records are written via
`…/repositories/prediction.py` into `…/models/prediction_record.py`.

**Result & PDF** — `sukaalicheck/app/(app)/predict/result/[id]/result-client.tsx` shows the risk
badge, the mandatory screening disclaimer, advice, and contributing factors. "Download PDF report"
uses the browser's `window.print()` with print-only CSS (in `sukaalicheck/app/globals.css`) — cards
carry `print:break-inside-avoid`, and a print-only header/footer make it read as a clean report.

---

## 5. Records (screening history)

Every prediction is stored per facility and browsable. `…/api/routes/predict.py` exposes:

- `GET /api/v1/predict/records` — list (optional `risk` filter, `limit`/`offset`),
- `GET /api/v1/predict/records/{prediction_id}` — single record,

both **facility-scoped** — a facility can only read its own records:

```python
record = PredictionRepository(db).get_by_prediction_id(prediction_id)
if not record or record.facility_id != facility.id:
    raise HTTPException(status_code=404, detail="Record not found")
```

Frontend: `sukaalicheck/app/(app)/records/` (list + detail), fed by helpers in
`sukaalicheck/lib/api.ts` and shown on the dashboard's "Recent predictions".

---

## 6. Admin portal

Separate session store (`sukaalicheck/stores/admin-auth.ts`) and UI under `sukaalicheck/app/admin/`.
A single admin account is seeded on startup — `…/app.py::_seed_admin` (username `admin`). All admin
endpoints (`…/api/routes/admin.py`) are guarded by `get_current_admin`:

- Facilities: list, detail, **approve**, **reject**, **resend OTP**, **unlock**, **delete**.
- Settings: **get / set** the `payment_enabled` toggle (see §3a).

The dashboard (`sukaalicheck/app/admin/dashboard/page.tsx`) uses TanStack Query for reads and
mutations (with cache invalidation + toasts).

---

## 7. Cross-cutting concerns

- **Errors** — `…/core/exceptions.py` defines a `DomainError` hierarchy
  (`NotFoundError` 404, `ConflictError` 409, `AuthError` 401, `ForbiddenError` 403,
  `ValidationError` 422, `PaymentProviderError` 502). A single handler in `…/app.py` turns any of
  them into `{"detail": "..."}` with the right HTTP status, so services just `raise` and routes stay
  clean.
- **Rate limiting** — slowapi (`…/core/rate_limit.py`): signup 5/hour, login & change-password
  10/minute.
- **Migrations** — Alembic (`…/alembic/`). Note: the app also runs `Base.metadata.create_all` at
  startup, so new-table migrations are written **idempotently** (create/alter only if missing) to
  avoid a "table already exists" clash — see the `app_settings` migration.
- **Design system** — brand colors and radii are CSS variables in
  `sukaalicheck/app/globals.css`; components use tokens (`bg-primary`, `text-danger`, `rounded-card`)
  rather than hard-coded hex. Mobile-first (360–414px primary target, bottom nav, sticky CTAs).
