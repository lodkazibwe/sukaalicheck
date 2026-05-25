"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Check, Loader2 } from "lucide-react";

import {
  signupSchema,
  type SignupInput,
  FACILITY_TYPES,
  OWNERSHIPS,
  DISTRICTS,
  SPECIALIST_TITLES,
} from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const STEP_META = [
  {
    label: "Facility",
    fields: [
      "facilityName",
      "facilityType",
      "ownership",
      "district",
      "physicalAddress",
      "facilityPhone",
      "facilityEmail",
    ] as const,
  },
  {
    label: "Specialist",
    fields: [
      "specialistName",
      "specialistTitle",
      "licenceNumber",
      "specialistEmail",
    ] as const,
  },
  { label: "Payment", fields: ["momoNumber"] as const },
] as const;

const TOTAL = STEP_META.length;
const ACTIVATION_AMOUNT = 50000;

function fmtUgx(n: number) {
  return `UGX ${n.toLocaleString("en-UG")}`;
}

function generateReference() {
  return `SK-${Math.floor(100000 + Math.random() * 900000)}`;
}

// ─── Shared primitives ───────────────────────────────────────────────────────

function StepHeader({ step, onBack }: { step: number; onBack: () => void }) {
  const meta = STEP_META[step - 1];
  return (
    <>
      <div className="flex items-start gap-2 px-4 pt-8 pb-3 bg-surface border-b border-border">
        <button
          type="button"
          onClick={onBack}
          className="h-11 w-11 flex items-center justify-center -ml-2 shrink-0"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Sign up your facility</h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of {TOTAL} · {meta.label}
          </p>
        </div>
      </div>

      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(step / TOTAL) * 100}%` }}
        />
      </div>

      <div className="flex items-start px-3 py-3 bg-surface border-b border-border">
        {STEP_META.map(({ label }, i) => {
          const num = i + 1;
          const done = num < step;
          const active = num === step;
          return (
            <div key={num} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={cn(
                  "h-7 w-7 rounded-full border-2 flex items-center justify-center transition-colors",
                  done
                    ? "bg-primary border-primary"
                    : active
                      ? "border-primary bg-surface"
                      : "border-border bg-surface"
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                ) : (
                  <span
                    className={cn(
                      "text-xs font-bold",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {num}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium leading-tight text-center",
                  done
                    ? "text-foreground"
                    : active
                      ? "text-primary font-semibold"
                      : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-4 pt-5 pb-3">
      <h2 className="text-2xl font-extrabold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function FieldCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 rounded-card border border-border bg-surface p-4 flex flex-col gap-4">
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}</span>;
}

function NavButtons({
  step,
  onBack,
  onContinue,
  submitLabel,
  isSubmitting,
}: {
  step: number;
  onBack: () => void;
  onContinue: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
}) {
  const isFirst = step === 1;
  const isLast = step === TOTAL;
  const continueLabel = isLast ? (submitLabel ?? "Submit") : "Continue";
  return (
    <div className="px-4 pt-3 pb-6 flex gap-3">
      {!isFirst && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={onBack}
          disabled={isSubmitting}
        >
          Back
        </Button>
      )}
      <Button
        type="button"
        size="lg"
        className={isFirst ? "w-full" : "flex-[2]"}
        onClick={onContinue}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : (
          continueLabel
        )}
      </Button>
    </div>
  );
}

// ─── Success view data ───────────────────────────────────────────────────────

interface SuccessData {
  facilityName: string;
  facilityEmail: string;
  reference: string;
  momoNumber: string;
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  async function advance() {
    const fields = [...STEP_META[step - 1].fields] as string[];
    const valid = await form.trigger(
      fields as Parameters<typeof form.trigger>[0]
    );
    if (!valid) return;
    if (step < TOTAL) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      await submit();
    }
  }

  function goBack() {
    if (step === 1) {
      router.back();
    } else {
      setStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function submit() {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    const data = form.getValues();
    setSuccess({
      facilityName: data.facilityName,
      facilityEmail: data.facilityEmail,
      reference: generateReference(),
      momoNumber: data.momoNumber,
    });
    setSubmitting(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Success view ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex flex-col max-w-lg mx-auto min-h-screen bg-surface px-6">
        <div className="flex-1 flex flex-col items-center justify-center gap-5 pt-16 pb-6">
          <div className="h-20 w-20 rounded-full bg-primary-50 flex items-center justify-center">
            <Check className="h-10 w-10 text-primary" strokeWidth={3} />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">
            You&apos;re all set.
          </h1>
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            <span className="font-bold text-foreground">{success.facilityName}</span>{" "}
            is now registered with SukaaliCheck.
            <br />
            We&apos;ve sent your login credentials to{" "}
            <span className="font-bold text-foreground">{success.facilityEmail}</span>.
          </p>

          <div className="rounded-card border border-border bg-surface p-4 w-full mt-2 flex flex-col gap-2.5">
            {(
              [
                ["Reference", success.reference],
                ["Amount paid", fmtUgx(ACTIVATION_AMOUNT)],
                ["Method", `MTN MoMo · ${success.momoNumber}`],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pb-10">
          <Button asChild size="lg" className="w-full">
            <Link href="/login">Continue to login</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Stepper view ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col max-w-lg mx-auto min-h-full bg-muted">
      <StepHeader step={step} onBack={goBack} />

      <Form {...form}>
        <div className="flex-1 pb-4">
          {/* ── Step 1: Facility ── */}
          {step === 1 && (
            <>
              <StepTitle
                title="Facility details"
                subtitle="Tell us about your facility. This appears on every screening report."
              />
              <FieldCard>
                <FormField
                  control={form.control}
                  name="facilityName"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Facility name</FieldLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Mulago Herbal Clinic"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="facilityType"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Facility type</FieldLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {FACILITY_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ownership"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Ownership</FieldLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select ownership" />
                          </SelectTrigger>
                          <SelectContent>
                            {OWNERSHIPS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>District</FieldLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select district" />
                          </SelectTrigger>
                          <SelectContent>
                            {DISTRICTS.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="physicalAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Physical address</FieldLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Plot 12, Mulago Hill Road"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="facilityPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Facility phone</FieldLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          inputMode="tel"
                          placeholder="+256 ..."
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="facilityEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Facility email</FieldLabel>
                      <FormControl>
                        <Input
                          type="email"
                          inputMode="email"
                          placeholder="facility@example.com"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FieldCard>
            </>
          )}

          {/* ── Step 2: Specialist ── */}
          {step === 2 && (
            <>
              <StepTitle
                title="Lead specialist"
                subtitle="The lead specialist on record for clinical sign-off."
              />
              <FieldCard>
                <FormField
                  control={form.control}
                  name="specialistName"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Full name</FieldLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Dr. Joan Mukasa"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="specialistTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Title / role</FieldLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select title" />
                          </SelectTrigger>
                          <SelectContent>
                            {SPECIALIST_TITLES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="licenceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Registration / licence number</FieldLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. UMDPC-12345"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="specialistEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Email</FieldLabel>
                      <FormControl>
                        <Input
                          type="email"
                          inputMode="email"
                          placeholder="specialist@example.com"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FieldCard>
            </>
          )}

          {/* ── Step 3: Payment ── */}
          {step === 3 && (
            <>
              <StepTitle
                title="Activate your account"
                subtitle="A one-time activation fee covers your first year of SukaaliCheck."
              />

              {/* Pricing card */}
              <div
                className="mx-4 mb-3 rounded-card border border-border bg-surface overflow-hidden"
                style={{ borderTop: "4px solid var(--brand-green)" }}
              >
                <div className="p-4 flex flex-col gap-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Activation
                  </p>
                  <p className="text-3xl font-extrabold text-foreground leading-tight">
                    {fmtUgx(ACTIVATION_AMOUNT)}
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}
                      / year
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                    Unlimited screenings · PDF reports · Patient records · Email
                    support
                  </p>
                </div>
              </div>

              {/* Payment method */}
              <div className="mx-4 mb-3 rounded-card border border-border bg-surface p-4 flex flex-col gap-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Payment method
                </p>
                <div className="rounded-input border-2 border-primary bg-primary-50 p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-input bg-amber-400 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-extrabold text-foreground">
                      MTN
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">MTN MoMo</p>
                    <p className="text-xs text-muted-foreground">
                      Mobile Money payment
                    </p>
                  </div>
                  <Check
                    className="h-5 w-5 text-primary shrink-0"
                    strokeWidth={3}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  More payment methods coming soon.
                </p>
              </div>

              {/* MoMo number */}
              <FieldCard>
                <FormField
                  control={form.control}
                  name="momoNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>MTN MoMo number</FieldLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          inputMode="tel"
                          placeholder="+256 7xx xxx xxx"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You will receive a prompt on your phone to authorize the payment
                  of{" "}
                  <span className="font-bold text-foreground">
                    {fmtUgx(ACTIVATION_AMOUNT)}
                  </span>
                  .
                </p>
              </FieldCard>
            </>
          )}
        </div>
      </Form>

      <NavButtons
        step={step}
        onBack={goBack}
        onContinue={advance}
        submitLabel={`Pay ${fmtUgx(ACTIVATION_AMOUNT)}`}
        isSubmitting={submitting}
      />
    </div>
  );
}
