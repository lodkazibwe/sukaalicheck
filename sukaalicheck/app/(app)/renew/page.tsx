"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Check, Loader2, Smartphone } from "lucide-react";

import { paymentSchema, type PaymentInput } from "@/lib/schemas";
import { getPlans, renewSubscription, getRenewStatus, facilityToStaff } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { daysUntil } from "@/lib/mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

function fmtUgx(n: number) {
  return `UGX ${n.toLocaleString("en-UG")}`;
}

function campDateRange(startIso: string): string {
  const [y, m, d] = startIso.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 4);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("en-UG", { weekday: "short", day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
}

export default function RenewPage() {
  const router = useRouter();
  const { token, user, setUser } = useAuthStore();

  const { data: plans, isLoading: plansLoading, isError: plansError } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    staleTime: Infinity,
  });

  const form = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
  });

  const watchedPlan = form.watch("plan");
  const watchedCampDate = form.watch("campStartDate");
  const selectedPlan = plans?.find((p) => p.plan_type === watchedPlan);

  const days = user?.subscriptionExpiresAt ? daysUntil(user.subscriptionExpiresAt) : -1;
  const expired = user?.subscriptionStatus === "expired" || days <= 0;

  // MoMo async flow: reference of an in-flight renewal to poll.
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [pendingNumber, setPendingNumber] = useState("");
  const [pollNonce, setPollNonce] = useState(0);
  const [tookTooLong, setTookTooLong] = useState(false);

  function onSuccess(facility: Parameters<typeof facilityToStaff>[0]) {
    setUser(facilityToStaff(facility));
    toast.success("Subscription renewed successfully");
    router.replace("/profile");
  }

  async function onSubmit(data: PaymentInput) {
    if (!token) return;
    try {
      const res = await renewSubscription(token, {
        plan_type: data.plan,
        momo_number: data.momoNumber,
        ...(data.plan === "camp_week" && data.campStartDate
          ? { camp_start_date: data.campStartDate }
          : {}),
      });
      if (res.status === "completed" && res.facility) {
        onSuccess(res.facility);
        return;
      }
      setPendingNumber(data.momoNumber);
      setTookTooLong(false);
      setPendingRef(res.reference);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Renewal failed. Please try again.");
    }
  }

  // Poll renewal status while a MoMo request is in flight.
  useEffect(() => {
    if (!pendingRef || !token) return;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // ~90s at 3s intervals
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await getRenewStatus(token, pendingRef);
        if (cancelled) return;
        if (res.status === "completed" && res.facility) {
          onSuccess(res.facility);
          return;
        }
        if (res.status === "failed") {
          toast.error(res.reason ?? "Payment was not completed. Please try again.");
          setPendingRef(null);
          return;
        }
      } catch {
        // transient error — keep polling
      }
      if (cancelled) return;
      if (attempts >= MAX_ATTEMPTS) {
        setTookTooLong(true);
        return;
      }
      timer = setTimeout(poll, 3000);
    };

    timer = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRef, token, pollNonce]);

  if (pendingRef) {
    return (
      <div className="flex flex-col max-w-lg mx-auto min-h-screen bg-muted px-4 pt-10">
        <div className="rounded-card border border-border bg-surface p-6 flex flex-col items-center text-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary-50 flex items-center justify-center">
            <Smartphone className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-foreground">Approve on your phone</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              We sent a payment request to{" "}
              <span className="font-semibold text-foreground">{pendingNumber}</span>. Enter your
              MoMo PIN on the prompt to complete the renewal.
            </p>
          </div>

          {!tookTooLong ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Waiting for confirmation…
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full">
              <p className="text-sm text-amber-600">
                This is taking longer than usual. If you approved the request, check again.
              </p>
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => {
                  setTookTooLong(false);
                  setPollNonce((n) => n + 1);
                }}
              >
                Check again
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setPendingRef(null)}
            className="text-sm font-semibold text-muted-foreground min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-lg mx-auto min-h-screen bg-muted">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-5 bg-surface border-b border-border">
        <button
          type="button"
          onClick={() => router.back()}
          className="h-11 w-11 flex items-center justify-center -ml-2 shrink-0"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold text-foreground">Renew subscription</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {expired
              ? "Your subscription has expired. Choose a plan to continue."
              : "Extend your access by choosing a plan below."}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1">
          <div className="flex-1 py-4 flex flex-col gap-4">
            {/* Current plan summary */}
            {user && (
              <div className="mx-4 rounded-card border border-border bg-surface p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Current plan
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-1">{user.plan}</p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      expired ? "text-danger" : "text-primary",
                    )}
                  >
                    {expired ? "Expired" : `${days} day${days === 1 ? "" : "s"} left`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Expires {user.subscriptionExpiry}
                  </p>
                </div>
              </div>
            )}

            {/* Plan cards */}
            {plansLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {plansError && (
              <div className="mx-4 rounded-card border border-destructive bg-surface p-4 text-sm text-destructive">
                Could not load plans. Please check your connection and try again.
              </div>
            )}

            {plans && (
              <FormField
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <FormItem className="mx-4">
                    <div className="flex flex-col gap-3">
                      {plans.map((p) => {
                        const selected = field.value === p.plan_type;
                        return (
                          <button
                            key={p.plan_type}
                            type="button"
                            onClick={() => {
                              field.onChange(p.plan_type);
                              if (p.plan_type !== "camp_week") {
                                form.setValue("campStartDate", undefined);
                              }
                            }}
                            className={cn(
                              "rounded-card border-2 p-4 text-left transition-colors w-full",
                              selected
                                ? "border-primary bg-primary-50"
                                : "border-border bg-surface",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div
                                  className={cn(
                                    "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center",
                                    selected ? "border-primary" : "border-border",
                                  )}
                                >
                                  {selected && (
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-foreground">{p.label}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {p.duration_label}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-base font-extrabold text-foreground">
                                  {fmtUgx(p.amount)}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Camp date picker */}
            {watchedPlan === "camp_week" && (
              <div className="mx-4 rounded-card border border-border bg-surface p-4 flex flex-col gap-3">
                <FormField
                  control={form.control}
                  name="campStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <span className="text-sm text-muted-foreground">Camp start date</span>
                      <FormControl>
                        <Input
                          type="date"
                          min={new Date().toISOString().split("T")[0]}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      {watchedCampDate && (
                        <p className="text-sm font-medium text-primary">
                          5-day session: {campDateRange(watchedCampDate)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Payment method */}
            <div className="mx-4 rounded-card border border-border bg-surface p-4 flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Payment method
              </p>
              <div className="rounded-input border-2 border-primary bg-primary-50 p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-input bg-amber-400 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-extrabold text-foreground">MTN</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">MTN MoMo</p>
                  <p className="text-xs text-muted-foreground">Mobile Money payment</p>
                </div>
                <Check className="h-5 w-5 text-primary shrink-0" strokeWidth={3} />
              </div>
              <p className="text-xs text-muted-foreground">More payment methods coming soon.</p>
            </div>

            {/* MoMo number */}
            <div className="mx-4 rounded-card border border-border bg-surface p-4 flex flex-col gap-3">
              <FormField
                control={form.control}
                name="momoNumber"
                render={({ field }) => (
                  <FormItem>
                    <span className="text-sm text-muted-foreground">MTN MoMo number</span>
                    <FormControl>
                      <Input
                        type="tel"
                        inputMode="tel"
                        placeholder="+256 7xx xxx xxx"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    {selectedPlan && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        You will be charged{" "}
                        <span className="font-bold text-foreground">
                          {fmtUgx(selectedPlan.amount)}
                        </span>{" "}
                        for {selectedPlan.duration_label.toLowerCase()} access.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="px-4 pt-3 pb-8">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={form.formState.isSubmitting || plansLoading}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : selectedPlan ? (
                `Pay ${fmtUgx(selectedPlan.amount)}`
              ) : (
                "Select a plan to continue"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
