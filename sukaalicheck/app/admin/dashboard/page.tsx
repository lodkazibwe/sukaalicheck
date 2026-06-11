"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminListFacilities,
  adminGetFacility,
  adminApproveFacility,
  adminRejectFacility,
  adminResendOtp,
  adminUnlockFacility,
  adminDeleteFacility,
  signout,
  type FacilityListItem,
  type FacilityDetail,
} from "@/lib/api";
import { useAdminAuth } from "@/stores/admin-auth";

const STATUS_TABS = [
  { label: "All", value: undefined },
  { label: "Pending review", value: "pending_approval" },
  { label: "Pending payment", value: "pending_payment" },
  { label: "Active", value: "active" },
  { label: "Rejected", value: "rejected" },
] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending_approval: { bg: "#FEF3C7", text: "#92400E" },
  pending_payment: { bg: "#DBEAFE", text: "#1E40AF" },
  active: { bg: "#D1FAE5", text: "#065F46" },
  rejected: { bg: "#FEE2E2", text: "#991B1B" },
};

const PLAN_NAMES: Record<string, string> = {
  monthly: "Monthly",
  annual: "Annual",
  camp_week: "Camp week",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { bg: "var(--surface-muted)", text: "var(--text-secondary)" };
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: colors.bg, color: colors.text }}
    >
      {statusLabel(status)}
    </span>
  );
}

function RejectModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "var(--surface)" }}
      >
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Reject facility
        </h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Provide a reason for rejection. This will be recorded and emailed to the facility.
        </p>
        <textarea
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-primary)",
          }}
          placeholder="e.g. Incomplete documentation"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-lg py-2.5 text-sm font-medium"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--brand-red)" }}
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({
  facilityName,
  onConfirm,
  onCancel,
}: {
  facilityName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const match = typed === facilityName;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "var(--surface)" }}
      >
        <h3 className="text-base font-semibold" style={{ color: "var(--brand-red)" }}>
          Delete facility
        </h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          This action is permanent and cannot be undone. All records associated with this facility will be deleted.
        </p>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          Type <strong>{facilityName}</strong> to confirm:
        </p>
        <input
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            border: `1px solid ${match ? "var(--brand-red)" : "var(--border)"}`,
            background: "var(--surface)",
            color: "var(--text-primary)",
          }}
          placeholder={facilityName}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-lg py-2.5 text-sm font-medium"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--brand-red)" }}
            disabled={!match}
            onClick={onConfirm}
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionSection({ detail }: { detail: FacilityDetail }) {
  const [now] = useState(Date.now);

  if (!detail.plan_type && !detail.subscription_expires_at) return null;

  const expiresAt = detail.subscription_expires_at
    ? new Date(detail.subscription_expires_at)
    : null;
  const daysLeft = expiresAt
    ? Math.ceil((expiresAt.getTime() - now) / 86_400_000)
    : null;
  const isExpired = daysLeft !== null && daysLeft < 0;
  const isExpiring = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

  return (
    <InfoSection title="Subscription">
      {detail.plan_type && (
        <InfoRow label="Plan" value={PLAN_NAMES[detail.plan_type] ?? detail.plan_type} />
      )}
      {expiresAt && (
        <InfoRow
          label="Expires"
          value={expiresAt.toLocaleDateString("en-UG", { dateStyle: "medium" })}
        />
      )}
      {daysLeft !== null && (
        <div className="flex gap-3 px-4 py-2.5">
          <span className="text-sm w-24 shrink-0" style={{ color: "var(--text-secondary)" }}>
            Status
          </span>
          <span
            className="text-sm font-medium"
            style={{
              color: isExpired
                ? "var(--brand-red)"
                : isExpiring
                ? "#D97706"
                : "var(--risk-low)",
            }}
          >
            {isExpired
              ? "Expired"
              : isExpiring
              ? `Expiring in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
              : `Active (${daysLeft} days left)`}
          </span>
        </div>
      )}
    </InfoSection>
  );
}

function FacilityDetailPanel({
  token,
  facility,
  onClose,
  onActionDone,
}: {
  token: string;
  facility: FacilityListItem;
  onClose: () => void;
  onActionDone: () => void;
}) {
  const qc = useQueryClient();
  const [showReject, setShowReject] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["admin-facility", facility.id],
    queryFn: () => adminGetFacility(token, facility.id),
  });

  const approve = useMutation({
    mutationFn: () => adminApproveFacility(token, facility.id),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["admin-facilities"] });
      qc.invalidateQueries({ queryKey: ["admin-facility", facility.id] });
      onActionDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Action failed"),
  });

  const reject = useMutation({
    mutationFn: (reason: string) => adminRejectFacility(token, facility.id, reason),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["admin-facilities"] });
      qc.invalidateQueries({ queryKey: ["admin-facility", facility.id] });
      setShowReject(false);
      onActionDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Action failed"),
  });

  const resendOtp = useMutation({
    mutationFn: () => adminResendOtp(token, facility.id),
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Action failed"),
  });

  const unlock = useMutation({
    mutationFn: () => adminUnlockFacility(token, facility.id),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["admin-facility", facility.id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Action failed"),
  });

  const deleteFacility = useMutation({
    mutationFn: () => adminDeleteFacility(token, facility.id),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["admin-facilities"] });
      onActionDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Action failed"),
  });

  const [now] = useState(Date.now);
  const isPendingApproval = facility.status === "pending_approval";
  const isPendingPayment = facility.status === "pending_payment";

  const isLocked =
    detail?.locked_until != null &&
    new Date(detail.locked_until).getTime() > now;

  return (
    <>
      {showReject && (
        <RejectModal
          onConfirm={(r) => reject.mutate(r)}
          onCancel={() => setShowReject(false)}
        />
      )}
      {showDelete && (
        <DeleteModal
          facilityName={facility.facility_name}
          onConfirm={() => deleteFacility.mutate()}
          onCancel={() => setShowDelete(false)}
        />
      )}

      <div className="flex flex-col h-full" style={{ background: "var(--surface)" }}>
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-full"
            style={{ background: "var(--surface-muted)" }}
            aria-label="Back"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {facility.facility_name}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {facility.facility_id}
            </p>
          </div>
          <StatusBadge status={facility.status} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div
                className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--brand-green)", borderTopColor: "transparent" }}
              />
            </div>
          ) : detail ? (
            <>
              {/* Lock warning */}
              {isLocked && (
                <div
                  className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                  style={{ background: "#FEF3C7", border: "1px solid #FCD34D" }}
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 shrink-0" style={{ color: "#92400E" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-xs font-medium" style={{ color: "#92400E" }}>
                      Account locked — {detail.failed_login_attempts} failed attempts
                    </span>
                  </div>
                  <button
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    style={{ background: "#92400E" }}
                    disabled={unlock.isPending}
                    onClick={() => unlock.mutate()}
                  >
                    {unlock.isPending ? "Unlocking…" : "Unlock"}
                  </button>
                </div>
              )}

              {/* Rejection reason */}
              {facility.status === "rejected" && detail.rejection_reason && (
                <div
                  className="rounded-xl px-4 py-3"
                  style={{ background: "var(--brand-red-50)", border: "1px solid #FECACA" }}
                >
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--brand-red)" }}>
                    Rejection reason
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {detail.rejection_reason}
                  </p>
                </div>
              )}

              <InfoSection title="Facility info">
                <InfoRow label="Type" value={detail.facility_type} />
                <InfoRow label="Ownership" value={detail.ownership} />
                <InfoRow label="District" value={detail.district} />
                <InfoRow label="Address" value={detail.physical_address} />
                <InfoRow label="Phone" value={detail.facility_phone} />
                <InfoRow label="Email" value={detail.facility_email} />
                <InfoRow
                  label="Registered"
                  value={new Date(detail.created_at).toLocaleDateString("en-UG", {
                    dateStyle: "medium",
                  })}
                />
              </InfoSection>

              {facility.status !== "pending_approval" && (
                <SubscriptionSection detail={detail} />
              )}

              {detail.specialist && (
                <InfoSection title="Specialist / supervisor">
                  <InfoRow label="Name" value={detail.specialist.specialist_name} />
                  <InfoRow label="Title" value={detail.specialist.specialist_title} />
                  <InfoRow label="Licence" value={detail.specialist.licence_number} />
                  <InfoRow label="Phone" value={detail.specialist.specialist_phone} />
                </InfoSection>
              )}
            </>
          ) : null}
        </div>

        {/* Actions */}
        <div
          className="px-4 py-4 flex flex-col gap-2 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {(isPendingApproval || isPendingPayment) && (
            <div className="flex gap-3">
              {isPendingApproval && (
                <>
                  <button
                    className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "var(--brand-green)" }}
                    disabled={approve.isPending || reject.isPending}
                    onClick={() => approve.mutate()}
                  >
                    {approve.isPending ? "Approving…" : "Approve"}
                  </button>
                  <button
                    className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "var(--brand-red)" }}
                    disabled={approve.isPending || reject.isPending}
                    onClick={() => setShowReject(true)}
                  >
                    Reject
                  </button>
                </>
              )}

              {isPendingPayment && (
                <button
                  className="flex-1 rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
                  style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  disabled={resendOtp.isPending}
                  onClick={() => resendOtp.mutate()}
                >
                  {resendOtp.isPending ? "Sending…" : "Resend OTP"}
                </button>
              )}
            </div>
          )}

          <button
            className="w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
            style={{ border: "1px solid var(--brand-red)", color: "var(--brand-red)" }}
            disabled={deleteFacility.isPending}
            onClick={() => setShowDelete(true)}
          >
            {deleteFacility.isPending ? "Deleting…" : "Delete facility"}
          </button>
        </div>
      </div>
    </>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div
        className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
        style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
      >
        {title}
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 px-4 py-2.5">
      <span className="text-sm w-24 shrink-0" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="text-sm font-medium flex-1" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { token, username, isHydrated, hydrate, logout } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<FacilityListItem | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace("/admin/login");
    }
  }, [isHydrated, token, router]);

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ["admin-facilities", activeTab],
    queryFn: () => adminListFacilities(token!, activeTab),
    enabled: !!token,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return facilities;
    return facilities.filter(
      (f) =>
        f.facility_name.toLowerCase().includes(q) ||
        f.facility_id.toLowerCase().includes(q) ||
        f.district.toLowerCase().includes(q),
    );
  }, [facilities, search]);

  async function handleLogout() {
    if (token) await signout(token).catch(() => {});
    logout();
    router.replace("/admin/login");
  }

  if (!isHydrated || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="h-7 w-7 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--brand-green)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="min-h-screen">
        <FacilityDetailPanel
          token={token}
          facility={selected}
          onClose={() => setSelected(null)}
          onActionDone={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header
        className="sticky top-0 z-10 px-4 py-4 flex items-center justify-between"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Facilities
          </h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Signed in as {username}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/admin/change-password")}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              background: "var(--surface)",
            }}
          >
            Password
          </button>
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              background: "var(--surface)",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Search + status filter */}
      <div
        className="sticky top-[57px] z-10 px-4 pt-3 pb-2 flex flex-col gap-2"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <input
          type="search"
          placeholder="Search by name, ID, or district…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface-muted)",
            color: "var(--text-primary)",
          }}
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={String(tab.value)}
                onClick={() => {
                  setActiveTab(tab.value);
                  setSelected(null);
                  setSearch("");
                }}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: isActive ? "var(--brand-green)" : "var(--surface-muted)",
                  color: isActive ? "#fff" : "var(--text-secondary)",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <main className="flex-1 px-4 py-4 flex flex-col gap-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div
              className="h-7 w-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--brand-green)", borderTopColor: "transparent" }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <svg
              className="h-10 w-10"
              style={{ color: "var(--border)" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {search ? "No facilities match your search" : "No facilities found"}
            </p>
          </div>
        ) : (
          filtered.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelected(f)}
              className="w-full rounded-xl p-4 text-left transition-opacity active:opacity-70"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p
                    className="font-semibold text-sm truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {f.facility_name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {f.facility_id} · {f.district}
                  </p>
                </div>
                <StatusBadge status={f.status} />
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
                Registered{" "}
                {new Date(f.created_at).toLocaleDateString("en-UG", { dateStyle: "medium" })}
              </p>
            </button>
          ))
        )}
      </main>
    </div>
  );
}
