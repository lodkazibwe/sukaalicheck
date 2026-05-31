"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { signout } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useLangStore, type Lang } from "@/stores/language";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const LANGS: { value: Lang; label: string; sub: string }[] = [
  { value: "en", label: "English", sub: "English" },
  { value: "lg", label: "Luganda", sub: "Olulimi" },
];

export default function ProfilePage() {
  const { user, token, logout } = useAuthStore();
  const { lang, setLang, hydrate } = useLangStore();
  const router = useRouter();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  async function handleLogout() {
    if (token) await signout(token).catch(() => {});
    logout();
    router.replace("/login");
  }

  function handleLang(l: Lang) {
    setLang(l);
    if (l === "lg") toast.info("Luganda translation coming soon");
  }

  return (
    <div className="flex flex-col max-w-lg mx-auto px-4 pt-8 pb-20 gap-5">
      <h1 className="text-xl font-bold text-foreground">Profile</h1>

      {/* Facility info */}
      <Card>
        <CardContent className="pt-4 flex flex-col gap-3">
          {[
            ["Name", user?.name ?? "—"],
            ["Facility ID", user?.facilityId ?? "—"],
            ["Facility", user?.facility ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-foreground">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Language */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">Language</p>
        <Card>
          <CardContent className="p-1 flex gap-1">
            {LANGS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => handleLang(l.value)}
                className={cn(
                  "flex-1 flex flex-col items-center py-3 rounded-card transition-colors",
                  lang === l.value
                    ? "bg-primary-50 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <span className={cn("text-sm font-semibold", lang === l.value ? "text-primary" : "text-foreground")}>
                  {l.label}
                </span>
                <span className="text-xs mt-0.5 opacity-70">{l.sub}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Button variant="outline" className="w-full" onClick={handleLogout}>
        Sign out
      </Button>
    </div>
  );
}
