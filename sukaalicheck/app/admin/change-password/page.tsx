"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminChangePassword } from "@/lib/api";
import { useAdminAuth } from "@/stores/admin-auth";

export default function AdminChangePasswordPage() {
  const router = useRouter();
  const { token, isHydrated, hydrate } = useAdminAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace("/admin/login");
    }
  }, [isHydrated, token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await adminChangePassword(token!, current, next);
      toast.success(res.message);
      router.replace("/admin/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center h-8 w-8 rounded-full"
          style={{ background: "var(--surface-muted)" }}
          aria-label="Back"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Change password
        </h1>
      </header>

      <main className="flex-1 px-4 py-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm mx-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Current password
            </label>
            <input
              type="password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              New password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Minimum 8 characters
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Confirm new password
            </label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white mt-2 disabled:opacity-60"
            style={{ background: "var(--brand-green)" }}
          >
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      </main>
    </div>
  );
}
