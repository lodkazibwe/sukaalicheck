# Admin Dashboard Roadmap

## Current state

The admin portal has: login, status-tab filtering, facility list, detail panel (facility + specialist info), **Approve** (generates OTP → emails facility → sets `pending_payment`), and **Reject** (captures reason in-memory but does **not** save it or email the facility).

The `Facility` model already carries `plan_type`, `subscription_expires_at`, `failed_login_attempts`, and `locked_until` — none are surfaced to the admin yet.

---

## Stage 1 — Quick wins

No new DB tables. At most one new endpoint each.

### 1. Client-side search *(frontend only)*
Filter already-fetched data by `facility_name`, `facility_id`, or `district` using `useMemo`.

**File:** `sukaalicheck/app/admin/dashboard/page.tsx`

---

### 2. Show plan + subscription in detail panel
`plan_type` and `subscription_expires_at` exist in the DB but are never returned by the API.

**Backend:** `schemas/admin.py` + `api/routes/admin.py` — expose both fields on `FacilityDetail`  
**Frontend:** `lib/api.ts` + `app/admin/dashboard/page.tsx` — show a "Subscription" section for non-`pending_approval` facilities

---

### 3. Persist rejection reason + show in detail panel
The rejection reason is currently discarded after the API call — there is no `rejection_reason` column.

**Backend:** Add column to `models/facility.py` → Alembic migration → save in `services/admin_service.py` → expose in `schemas/admin.py`  
**Frontend:** Show reason in detail panel when status is `rejected`

---

### 4. Rejection notification email *(backend only)*
Approval sends an OTP email; rejection is silent. Add a notification email on rejection.

**Backend:** `core/email.py` + `templates/email/rejection.html` + `services/admin_service.py`

---

### 5. OTP resend button
After approval, if the OTP email wasn't received, admin has no way to resend it.

**Backend:** New `POST /api/v1/admin/facilities/{uuid}/resend-otp` — reuses existing OTP + email logic from `approve()`  
**Frontend:** "Resend OTP" button visible for `pending_payment` facilities, with loading state + toast

---

### 6. Lock status + Unlock button
`failed_login_attempts` and `locked_until` exist in the DB but are invisible to admin.

**Backend:** Expose both fields on `FacilityDetail`; new `POST /api/v1/admin/facilities/{uuid}/unlock` (calls `FacilityRepository.reset_failed_attempts()` which already exists)  
**Frontend:** Lock warning + "Unlock account" button when `locked_until` is in the future

##6.5 change password for admin

---

## Stage 2 — Larger changes

New tables, multi-step flows, or cross-cutting concerns.

### 7. Payment confirmation flow *(most critical missing piece)*
The lifecycle stalls after OTP login — admin has no UI to confirm payment and activate a facility.

- New endpoint `POST /api/v1/admin/facilities/{uuid}/confirm-payment` — sets `plan_type`, computes `subscription_expires_at`, sets `status = "active"`, creates a `PaymentRecord`, sends activation email
- New admin UI for `pending_payment` facilities: plan dropdown + MoMo reference input + "Confirm payment" button

---

### 8. Admin dashboard summary stats
A summary bar at the top: total facilities, pending review, active, total predictions this month.

- New endpoint `GET /api/v1/admin/stats`
- Stat-card row loaded once on mount with TanStack Query

---

### 9. Prediction activity per facility
Show usage context in the detail panel: total predictions, high-risk count, last prediction date.

- New endpoint `GET /api/v1/admin/facilities/{uuid}/stats` — reuses `PredictionRepository.count_by_facility()` (already exists)
- Small read-only section in detail panel

---

### 10. Audit log
Track every admin action (approved, rejected, unlocked, OTP resent, payment confirmed).

- New `AuditLog` model + Alembic migration (columns: id, admin_username, action, facility_id, detail, created_at)
- Hook into every admin service method
- New endpoint `GET /api/v1/admin/audit-log?facility_id=&limit=&offset=`
- Collapsible section in facility detail view

---

### 11. Inline facility edit
Admin can correct typos in facility name, district, or contact details without re-registration.

- New `PATCH /api/v1/admin/facilities/{uuid}` endpoint
- Edit-mode toggle in detail panel with save/cancel

---

## Verification (Stage 1)

```bash
cd sukaali-check-backend && uv run sukaali-check-backend   # :8000
cd sukaalicheck && npm run dev                              # :3000
```

1. Search box → filters list in real time
2. Open an active facility → plan type and subscription expiry appear
3. Reject a facility with a reason → DB column set; detail panel shows reason; facility receives email
4. Approve → status = `pending_payment` → click "Resend OTP" → new OTP email arrives
5. Simulate 10 failed logins → admin sees lock warning + "Unlock account"; click → facility can log in
