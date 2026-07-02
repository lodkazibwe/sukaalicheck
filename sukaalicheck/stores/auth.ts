"use client";

import { create } from "zustand";
import type { Staff } from "@/lib/mock";

interface AuthState {
  token: string | null;
  scope: string | null;
  user: Staff | null;
  isHydrated: boolean;
  hydrate: () => void;
  setToken: (token: string, scope: string) => void;
  login: (token: string, user: Staff) => void;
  setUser: (user: Staff) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  scope: null,
  user: null,
  isHydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = sessionStorage.getItem("auth_token");
    const scope = sessionStorage.getItem("auth_scope");
    const raw = sessionStorage.getItem("auth_user");
    const user: Staff | null = raw ? (JSON.parse(raw) as Staff) : null;
    set({ token, scope, user, isHydrated: true });
  },

  setToken: (token, scope) => {
    sessionStorage.setItem("auth_token", token);
    sessionStorage.setItem("auth_scope", scope);
    set({ token, scope });
  },

  login: (token, user) => {
    sessionStorage.setItem("auth_token", token);
    sessionStorage.setItem("auth_scope", "facility");
    sessionStorage.setItem("auth_user", JSON.stringify(user));
    set({ token, scope: "facility", user });
  },

  setUser: (user) => {
    sessionStorage.setItem("auth_user", JSON.stringify(user));
    set({ user });
  },

  logout: () => {
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("auth_scope");
    sessionStorage.removeItem("auth_user");
    set({ token: null, scope: null, user: null });
  },
}));
