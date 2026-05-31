"use client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--surface-muted)" }}>
      {children}
    </div>
  );
}
