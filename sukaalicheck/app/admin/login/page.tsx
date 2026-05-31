"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { adminLogin } from "@/lib/api";
import { useAdminAuth } from "@/stores/admin-auth";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { token, isHydrated, hydrate, login } = useAdminAuth();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && token) {
      router.replace("/admin/dashboard");
    }
  }, [isHydrated, token, router]);

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await adminLogin(data.username, data.password);
      login(res.access_token, res.username);
      router.push("/admin/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-sm rounded-xl p-6 shadow-sm"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="mb-6 text-center">
          <div
            className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-3"
            style={{ background: "var(--brand-green-50)" }}
          >
            <svg
              className="h-6 w-6"
              style={{ color: "var(--brand-green)" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Admin portal
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            SukaaliCheck facility management
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Username
            </label>
            <input
              {...register("username")}
              autoComplete="username"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
              style={{
                border: `1px solid ${errors.username ? "var(--brand-red)" : "var(--border)"}`,
                background: "var(--surface)",
                color: "var(--text-primary)",
              }}
              placeholder="admin"
            />
            {errors.username && (
              <span className="text-xs" style={{ color: "var(--brand-red)" }}>
                {errors.username.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Password
            </label>
            <input
              {...register("password")}
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
              style={{
                border: `1px solid ${errors.password ? "var(--brand-red)" : "var(--border)"}`,
                background: "var(--surface)",
                color: "var(--text-primary)",
              }}
              placeholder="••••••••"
            />
            {errors.password && (
              <span className="text-xs" style={{ color: "var(--brand-red)" }}>
                {errors.password.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-lg py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: "var(--brand-green)" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
