import type { Staff } from "@/lib/mock";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ detail: "Request failed" }))) as {
      detail?: string;
    };
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FacilityOut {
  id: string;
  facility_id: string;
  facility_name: string;
  status: string;
  plan_type: string | null;
  subscription_expires_at: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  scope: string;
  facility: FacilityOut;
}

export interface PlanOption {
  plan_type: string;
  label: string;
  amount: number;
  duration_label: string;
}

export interface PaymentResponse {
  reference: string;
  plan_type: string;
  amount: number;
  plan_start_date: string;
  plan_end_date: string;
  status: string;
  access_token: string;
  token_type: string;
}

// ─── Auth endpoints ───────────────────────────────────────────────────────────

export interface SignupPayload {
  facility_name: string;
  facility_type: string;
  ownership: string;
  district: string;
  physical_address: string;
  facility_phone: string;
  facility_email: string;
  specialist_name: string;
  specialist_title: string;
  licence_number: string;
  specialist_phone: string;
}

export interface SignupResult {
  message: string;
  facility_id: string;
}

export function signupFacility(data: SignupPayload): Promise<SignupResult> {
  return apiFetch("/api/v1/auth/signup", { method: "POST", body: JSON.stringify(data) });
}

export function loginFacility(facility_id: string, password: string): Promise<AuthResponse> {
  return apiFetch("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ facility_id, password }),
  });
}

export function signout(token: string): Promise<{ message: string }> {
  return apiFetch("/api/v1/auth/signout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function changePassword(
  token: string,
  new_password: string,
  confirm_password: string,
): Promise<AuthResponse> {
  return apiFetch("/api/v1/auth/change-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ new_password, confirm_password }),
  });
}

// ─── Payment endpoints ────────────────────────────────────────────────────────

export function getPlans(): Promise<PlanOption[]> {
  return apiFetch("/api/v1/payment/plans");
}

export interface InitiatePaymentPayload {
  plan_type: string;
  momo_number: string;
  camp_start_date?: string;
}

export function initiatePayment(
  token: string,
  data: InitiatePaymentPayload,
): Promise<PaymentResponse> {
  return apiFetch("/api/v1/payment/initiate", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// ─── Admin types ─────────────────────────────────────────────────────────────

export interface AdminLoginResponse {
  access_token: string;
  token_type: string;
  scope: string;
  username: string;
}

export interface FacilityListItem {
  id: string;
  facility_id: string;
  facility_name: string;
  district: string;
  status: string;
  created_at: string;
}

export interface SpecialistOut {
  id: string;
  specialist_name: string;
  specialist_title: string;
  licence_number: string;
  specialist_phone: string;
}

export interface FacilityDetail extends FacilityListItem {
  facility_type: string;
  ownership: string;
  physical_address: string;
  facility_phone: string;
  facility_email: string;
  plan_type: string | null;
  subscription_expires_at: string | null;
  rejection_reason: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  specialist: SpecialistOut | null;
}

// ─── Admin endpoints ──────────────────────────────────────────────────────────

export function adminLogin(username: string, password: string): Promise<AdminLoginResponse> {
  return apiFetch("/api/v1/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function adminListFacilities(
  token: string,
  status?: string,
): Promise<FacilityListItem[]> {
  const qs = status ? `?status=${status}` : "";
  return apiFetch(`/api/v1/admin/facilities${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminGetFacility(token: string, id: string): Promise<FacilityDetail> {
  return apiFetch(`/api/v1/admin/facilities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminApproveFacility(token: string, id: string): Promise<{ message: string }> {
  return apiFetch(`/api/v1/admin/facilities/${id}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
}

export function adminRejectFacility(
  token: string,
  id: string,
  reason: string,
): Promise<{ message: string }> {
  return apiFetch(`/api/v1/admin/facilities/${id}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason }),
  });
}

export function adminResendOtp(token: string, id: string): Promise<{ message: string }> {
  return apiFetch(`/api/v1/admin/facilities/${id}/resend-otp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminUnlockFacility(token: string, id: string): Promise<{ message: string }> {
  return apiFetch(`/api/v1/admin/facilities/${id}/unlock`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminDeleteFacility(token: string, id: string): Promise<{ message: string }> {
  return apiFetch(`/api/v1/admin/facilities/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function adminChangePassword(
  token: string,
  current_password: string,
  new_password: string,
): Promise<{ message: string }> {
  return apiFetch("/api/v1/admin/auth/change-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ current_password, new_password }),
  });
}

// ─── Prediction ──────────────────────────────────────────────────────────────

export interface PredictPayload {
  age: number;
  sex: "Male" | "Female";
  weight_kg: number;
  height_cm: number;
  family_history_diabetes: "yes" | "no";
  hypertension: "yes" | "no";
  physical_activity: "low" | "intermediate" | "high";
  diet_quality: number;
  blood_glucose?: number;
}

export interface PredictResult {
  prediction_id: string;
  risk_level: "low" | "intermediate" | "high";
  risk_score: number;
  key_factors: string[];
  created_at: string;
}

export function predict(token: string, data: PredictPayload): Promise<PredictResult> {
  return apiFetch("/api/v1/predict", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface RecordOut {
  prediction_id: string;
  age: number;
  sex: string;
  bmi: number;
  risk_level: "low" | "intermediate" | "high";
  risk_score: number;
  key_factors: string[];
  created_at: string;
}

export interface RecordsResponse {
  records: RecordOut[];
  total: number;
}

export function getRecords(
  token: string,
  params?: { risk?: string; limit?: number; offset?: number },
): Promise<RecordsResponse> {
  const qs = new URLSearchParams();
  if (params?.risk) qs.set("risk", params.risk);
  if (params?.limit !== undefined) qs.set("limit", String(params.limit));
  if (params?.offset !== undefined) qs.set("offset", String(params.offset));
  const q = qs.toString();
  return apiFetch(`/api/v1/predict/records${q ? `?${q}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getRecord(token: string, predictionId: string): Promise<RecordOut> {
  return apiFetch(`/api/v1/predict/records/${predictionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_NAMES: Record<string, string> = {
  monthly: "Monthly plan",
  annual: "Annual plan",
  camp_week: "Camp week",
};

export function facilityToStaff(facility: FacilityOut): Staff {
  const expiresAt = facility.subscription_expires_at;
  let subscriptionStatus: "active" | "expiring" | "expired" = "expired";
  if (expiresAt) {
    const daysLeft = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
    if (daysLeft > 7) subscriptionStatus = "active";
    else if (daysLeft >= 0) subscriptionStatus = "expiring";
  }
  return {
    id: facility.id,
    name: facility.facility_name,
    facilityId: facility.facility_id,
    facility: facility.facility_name,
    subscriptionStatus,
    subscriptionExpiry: expiresAt
      ? new Date(expiresAt).toLocaleDateString("en-UG", { dateStyle: "medium" })
      : "—",
    subscriptionExpiresAt: expiresAt,
    plan: facility.plan_type ? (PLAN_NAMES[facility.plan_type] ?? facility.plan_type) : "—",
  };
}
