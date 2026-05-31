"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/stores/admin-auth";

export default function AdminRootPage() {
  const router = useRouter();
  const { token, isHydrated, hydrate } = useAdminAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    if (token) {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/admin/login");
    }
  }, [isHydrated, token, router]);

  return null;
}
