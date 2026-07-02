"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

import { signout } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useLangStore, type Lang } from "@/stores/language";
import { daysUntil } from "@/lib/mock";
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

  const days = user?.subscriptionExpiresAt ? daysUntil(user.subscriptionExpiresAt) : -1;
  const expired = user?.subscriptionStatus === "expired" || days <= 0;
  const expiring = !expired && days <= 7;

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

      {/* Subscription */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">Subscription</p>
        <Card>
          <CardContent className="pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium text-foreground">{user?.plan ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span
                className={cn(
                  "font-semibold",
                  expired ? "text-danger" : expiring ? "text-amber-600" : "text-primary",
                )}
              >
                {expired
                  ? "Expired"
                  : expiring
                  ? `Expiring · ${days} day${days === 1 ? "" : "s"} left`
                  : `Active · ${days} days left`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Expires</span>
              <span className="font-medium text-foreground">{user?.subscriptionExpiry ?? "—"}</span>
            </div>
            <Link
              href="/renew"
              className="mt-1 flex items-center justify-between rounded-input border border-primary bg-primary-50 px-4 py-3 min-h-[44px] active:opacity-90 transition-opacity"
            >
              <span className="text-sm font-semibold text-primary">Renew subscription</span>
              <ChevronRight className="h-4 w-4 text-primary shrink-0" />
            </Link>
          </CardContent>
        </Card>
      </div>

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
