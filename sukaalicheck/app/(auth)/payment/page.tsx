"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";

import { paymentSchema, type PaymentInput } from "@/lib/schemas";
import { getPlans, initiatePayment } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
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

export default function PaymentPage() {
  const router = useRouter();
  const { hydrate, isHydrated, token, scope, setToken } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!token || scope !== "first_login") {
      router.replace("/login");
    }
  }, [isHydrated, token, scope, router]);

  const { data: plans, isLoading: plansLoading, isError: plansError } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    staleTime: Infinity,
    enabled: isHydrated && scope === "first_login",
  });

  const form = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
  });

  const watchedPlan = form.watch("plan");
  const watchedCampDate = form.watch("campStartDate");
  const selectedPlan = plans?.find((p) => p.plan_type === watchedPlan);

  async function onSubmit(data: PaymentInput) {
    if (!token) return;
    try {
      const res = await initiatePayment(token, {
        plan_type: data.plan,
        momo_number: data.momoNumber,
        ...(data.plan === "camp_week" && data.campStartDate
          ? { camp_start_date: data.campStartDate }
          : {}),
      });
      setToken(res.access_token, "payment_done");
      router.replace("/change-password");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed. Please try again.");
    }
  }

  if (!isHydrated || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-lg mx-auto min-h-screen bg-muted">
      {/* Header */}
      <div className="px-4 pt-10 pb-5 bg-surface border-b border-border">
        <h1 className="text-2xl font-extrabold text-foreground">Choose a plan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select the package that works for your facility.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1"
        >
          <div className="flex-1 py-4 flex flex-col gap-4">
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
