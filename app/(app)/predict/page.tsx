"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Check, Loader2 } from "lucide-react";

import { predictionSchema, type PredictionInput } from "@/lib/schemas";
import { computeRisk, bmi, bmiCategory } from "@/lib/risk-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

// ─── Step metadata ───────────────────────────────────────────────────────────

const STEP_META = [
  { label: "Patient",   fields: ["age", "sex"] as const },
  { label: "Body",      fields: ["weight", "height"] as const },
  { label: "History",   fields: ["familyHistoryDiabetes", "hypertension"] as const },
  { label: "Lifestyle", fields: ["physicalActivity", "dietQuality"] as const },
  { label: "Blood",     fields: ["bloodGlucose"] as const },
  { label: "Review",    fields: [] as const },
] as const;

const TOTAL = STEP_META.length;

// ─── Stepper header ──────────────────────────────────────────────────────────

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
          <h1 className="text-lg font-bold text-foreground">New prediction</h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of {TOTAL} · {meta.label}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(step / TOTAL) * 100}%` }}
        />
      </div>

      {/* Step bubbles */}
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

// ─── Shared primitives ───────────────────────────────────────────────────────

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
  return (
    <span className="text-sm text-muted-foreground">{children}</span>
  );
}

type YesNo = "yes" | "no";

function YesNoToggle({
  value,
  onChange,
}: {
  value: YesNo | undefined;
  onChange: (v: YesNo) => void;
}) {
  return (
    <div className="flex gap-2">
      {(["yes", "no"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "flex-1 h-11 rounded-input border text-sm font-semibold transition-colors",
            value === opt
              ? "border-primary bg-primary-50 text-primary"
              : "border-border bg-surface text-foreground"
          )}
        >
          {opt === "yes" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-input bg-muted p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 h-9 rounded-xl text-sm transition-colors",
            value === opt.value
              ? "bg-surface font-bold text-foreground shadow-sm"
              : "font-medium text-muted-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Nav buttons ─────────────────────────────────────────────────────────────

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
            Calculating…
          </>
        ) : (
          continueLabel
        )}
      </Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PredictPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const form = useForm<PredictionInput>({
    resolver: zodResolver(predictionSchema),
    defaultValues: {
      dietQuality: 5,
    },
  });

  const weight = form.watch("weight");
  const height = form.watch("height");
  const computedBmi = useMemo(() => {
    if (weight && height && height >= 100) {
      const b = bmi(weight, height);
      return { value: b.toFixed(1), category: bmiCategory(b) };
    }
    return null;
  }, [weight, height]);

  async function advance() {
    const fields = [...STEP_META[step - 1].fields] as string[];
    if (fields.length > 0) {
      const valid = await form.trigger(fields as Parameters<typeof form.trigger>[0]);
      if (!valid) return;
    }
    if (step < TOTAL) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      await submit();
    }
  }

  async function goBack() {
    if (step === 1) {
      router.back();
    } else {
      setStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function submit() {
    const data = form.getValues();
    await new Promise((r) => setTimeout(r, 600));
    const result = computeRisk(data);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`pred_${result.id}`, JSON.stringify(result));
    }
    router.push(`/predict/result/${result.id}`);
  }

  const isSubmitting = form.formState.isSubmitting;
  const values = form.getValues();

  return (
    <div className="flex flex-col max-w-lg mx-auto min-h-full bg-muted">
      <StepHeader step={step} onBack={goBack} />

      <Form {...form}>
        <div className="flex-1 pb-4">

          {/* ── Step 1: Patient ── */}
          {step === 1 && (
            <>
              <StepTitle
                title="Patient information"
                subtitle="Start with the patient's basic information."
              />


              <FieldCard>
                {/* Age */}
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Age</FieldLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="e.g. 42"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value)
                            )
                          }
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Sex */}
                <FormField
                  control={form.control}
                  name="sex"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Sex</FieldLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          {(["Male", "Female"] as const).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => field.onChange(opt)}
                              className={cn(
                                "flex-1 h-11 rounded-input border text-sm font-semibold transition-colors",
                                field.value === opt
                                  ? "border-primary bg-primary-50 text-primary"
                                  : "border-border bg-surface text-foreground"
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FieldCard>
            </>
          )}

          {/* ── Step 2: Body ── */}
          {step === 2 && (
            <>
              <StepTitle
                title="Body measurements"
                subtitle="BMI is calculated automatically from weight and height."
              />
              <FieldCard>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FieldLabel>Weight (kg)</FieldLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="e.g. 72.5"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? undefined : Number(e.target.value)
                              )
                            }
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FieldLabel>Height (cm)</FieldLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="e.g. 168"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? undefined : Number(e.target.value)
                              )
                            }
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* BMI auto */}
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>BMI (auto)</FieldLabel>
                  <div
                    className={cn(
                      "h-12 rounded-input border px-3 flex items-center justify-between transition-colors",
                      computedBmi ? "border-primary bg-primary-50" : "border-border bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "text-base font-bold",
                        computedBmi ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {computedBmi?.value ?? "—"}
                    </span>
                    {computedBmi && (
                      <span className="rounded-full border border-primary/30 bg-surface px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {computedBmi.category}
                      </span>
                    )}
                  </div>
                </div>
              </FieldCard>
            </>
          )}

          {/* ── Step 3: History ── */}
          {step === 3 && (
            <>
              <StepTitle
                title="Medical history"
                subtitle="Note family history and any known hypertension."
              />
              <FieldCard>
                <FormField
                  control={form.control}
                  name="familyHistoryDiabetes"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Family history of diabetes</FieldLabel>
                      <FormControl>
                        <YesNoToggle
                          value={field.value as YesNo | undefined}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hypertension"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Hypertension</FieldLabel>
                      <FormControl>
                        <YesNoToggle
                          value={field.value as YesNo | undefined}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FieldCard>
            </>
          )}

          {/* ── Step 4: Lifestyle ── */}
          {step === 4 && (
            <>
              <StepTitle
                title="Lifestyle"
                subtitle="Daily activity level and diet quality."
              />
              <FieldCard>
                <FormField
                  control={form.control}
                  name="physicalActivity"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Physical activity level</FieldLabel>
                      <FormControl>
                        <SegmentedControl
                          options={[
                            { label: "Low", value: "low" },
                            { label: "Moderate", value: "moderate" },
                            { label: "High", value: "high" },
                          ]}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dietQuality"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FieldLabel>Diet quality</FieldLabel>
                        <span className="text-sm font-semibold text-primary">
                          {field.value} / 10
                        </span>
                      </div>
                      <FormControl>
                        <Slider
                          min={1}
                          max={10}
                          step={1}
                          value={[field.value ?? 5]}
                          onValueChange={(v) => field.onChange(v[0])}
                          className="mt-1"
                        />
                      </FormControl>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Poor</span>
                        <span className="text-xs text-muted-foreground">Excellent</span>
                      </div>
                    </FormItem>
                  )}
                />
              </FieldCard>
            </>
          )}

          {/* ── Step 5: Blood ── */}
          {step === 5 && (
            <>
              <StepTitle
                title="Blood test"
                subtitle="Use the most recent fasting glucose reading."
              />
              <FieldCard>
                <FormField
                  control={form.control}
                  name="bloodGlucose"
                  render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Blood glucose (mg/dL)</FieldLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="e.g. 95"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value)
                            )
                          }
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Reference ranges */}
                <div className="rounded-input bg-muted px-4 py-3 flex flex-col gap-1.5">
                  <p className="text-xs font-bold text-foreground">
                    Reference ranges (fasting)
                  </p>
                  {[
                    ["< 100 mg/dL", "Normal"],
                    ["100–125 mg/dL", "Prediabetes"],
                    ["≥ 126 mg/dL", "Diabetes range"],
                  ].map(([range, label]) => (
                    <p key={range} className="text-xs text-muted-foreground">
                      {range} — {label}
                    </p>
                  ))}
                </div>
              </FieldCard>
            </>
          )}

          {/* ── Step 6: Review ── */}
          {step === 6 && (
            <>
              <StepTitle
                title="Review & submit"
                subtitle="Confirm details below before running the prediction."
              />
              <div className="mx-4 rounded-card border border-border bg-surface divide-y divide-border">
                {[
                  { label: "Age", value: values.age ? `${values.age}` : "—", goStep: 1 },
                  { label: "Sex", value: values.sex ?? "—", goStep: 1 },
                  {
                    label: "Weight (kg)",
                    value: values.weight ? `${values.weight} kg` : "—",
                    goStep: 2,
                  },
                  {
                    label: "Height (cm)",
                    value: values.height ? `${values.height} cm` : "—",
                    goStep: 2,
                  },
                  {
                    label: "BMI",
                    value:
                      values.weight && values.height
                        ? (() => {
                            const b = bmi(values.weight, values.height);
                            return `${b.toFixed(1)} (${bmiCategory(b)})`;
                          })()
                        : "—",
                    goStep: 2,
                  },
                  {
                    label: "Family history of diabetes",
                    value:
                      values.familyHistoryDiabetes === "yes"
                        ? "Yes"
                        : values.familyHistoryDiabetes === "no"
                          ? "No"
                          : "—",
                    goStep: 3,
                  },
                  {
                    label: "Hypertension",
                    value:
                      values.hypertension === "yes"
                        ? "Yes"
                        : values.hypertension === "no"
                          ? "No"
                          : "—",
                    goStep: 3,
                  },
                  {
                    label: "Physical activity level",
                    value: values.physicalActivity
                      ? values.physicalActivity.charAt(0).toUpperCase() +
                        values.physicalActivity.slice(1)
                      : "—",
                    goStep: 4,
                  },
                  {
                    label: "Diet quality",
                    value: values.dietQuality ? `${values.dietQuality} / 10` : "—",
                    goStep: 4,
                  },
                  {
                    label: "Blood glucose (mg/dL)",
                    value: values.bloodGlucose ? `${values.bloodGlucose} mg/dL` : "Not entered",
                    goStep: 5,
                  },
                ].map(({ label, value, goStep }) => (
                  <div key={label} className="flex items-start justify-between px-4 py-3.5 gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {label}
                      </p>
                      <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(goStep)}
                      className="text-sm font-semibold text-primary shrink-0 min-h-[44px] flex items-center"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Form>

      <NavButtons
        step={step}
        onBack={goBack}
        onContinue={advance}
        submitLabel="Predict diabetes risk"
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
