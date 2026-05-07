"use client";

import { create } from "zustand";

export type Lang = "en" | "lg";

interface LangState {
  lang: Lang;
  isHydrated: boolean;
  hydrate: () => void;
  setLang: (l: Lang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: "en",
  isHydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("app_lang") as Lang | null;
    set({ lang: stored ?? "en", isHydrated: true });
  },

  setLang: (lang) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("app_lang", lang);
    }
    set({ lang });
  },
}));
