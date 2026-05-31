"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminListFacilities,
  adminGetFacility,
  adminApproveFacility,
  adminRejectFacility,
  signout,
  type FacilityListItem,
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
          Provide a reason for rejection. This will be recorded.
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

  const isPendingApproval = facility.status === "pending_approval";

  return (
    <>
      {showReject && (
        <RejectModal
          onConfirm={(r) => reject.mutate(r)}
          onCancel={() => setShowReject(false)}
        />
      )}

      <div
        className="flex flex-col h-full"
        style={{ background: "var(--surface)" }}
      >
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
        {isPendingApproval && (
          <div
            className="px-4 py-4 flex gap-3 border-t"
            style={{ borderColor: "var(--border)" }}
          >
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
          </div>
        )}
      </div>
    </>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
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
      </header>

      {/* Status filter tabs */}
      <div
        className="sticky top-[57px] z-10 flex gap-2 overflow-x-auto px-4 py-2.5"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={String(tab.value)}
              onClick={() => {
                setActiveTab(tab.value);
                setSelected(null);
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

      {/* List */}
      <main className="flex-1 px-4 py-4 flex flex-col gap-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div
              className="h-7 w-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--brand-green)", borderTopColor: "transparent" }}
            />
          </div>
        ) : facilities.length === 0 ? (
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
              No facilities found
            </p>
          </div>
        ) : (
          facilities.map((f) => (
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
