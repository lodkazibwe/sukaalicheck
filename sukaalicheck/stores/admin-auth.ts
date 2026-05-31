"use client";

import { create } from "zustand";

interface AdminAuthState {
  token: string | null;
  username: string | null;
  isHydrated: boolean;
  hydrate: () => void;
  login: (token: string, username: string) => void;
  logout: () => void;
}

export const useAdminAuth = create<AdminAuthState>((set) => ({
  token: null,
  username: null,
  isHydrated: false,

  hydrate() {
    const token = sessionStorage.getItem("admin_token");
    const username = sessionStorage.getItem("admin_username");
    set({ token, username, isHydrated: true });
  },

  login(token, username) {
    sessionStorage.setItem("admin_token", token);
    sessionStorage.setItem("admin_username", username);
    set({ token, username });
  },

  logout() {
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_username");
    set({ token: null, username: null });
  },
}));
