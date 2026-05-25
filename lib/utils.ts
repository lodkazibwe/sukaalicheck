import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function patientId(recordId: string): string {
  const src = recordId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  let out = "";
  for (let i = 0; i < 8; i++) {
    const code = src.charCodeAt(i % src.length) || 65;
    out += PID_CHARS[code % PID_CHARS.length];
  }
  return out;
}
