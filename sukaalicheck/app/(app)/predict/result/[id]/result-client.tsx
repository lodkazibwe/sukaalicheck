"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Share2,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

import { type PredictionRecord, type RiskLevel } from "@/lib/mock";
import { getRecord, type RecordOut } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, patientId } from "@/lib/utils";

function apiToLocal(r: RecordOut, id: string): PredictionRecord {
  return {
    id,
    patientName: `Patient #p_${id.slice(-4)}`,
    age: r.age,
    sex: r.sex as "Male" | "Female",
    riskLevel: r.risk_level,
    riskScore: r.risk_score,
    createdAt: r.created_at,
    keyFactors: r.key_factors,
    staffId: "",
  };
}

// ── risk helpers ──────────────────────────────────────────────────────────────

function riskCss(level: RiskLevel) {
  if (level === "high") return "var(--risk-high)";
  if (level === "intermediate") return "var(--risk-intermediate)";
  return "var(--risk-low)";
}

function riskLabel(level: RiskLevel) {
  if (level === "high") return "High risk";
  if (level === "intermediate") return "Intermediate risk";
  return "Low risk";
}

function riskTextClass(level: RiskLevel) {
  if (level === "high") return "text-danger";
  if (level === "intermediate") return "text-risk-intermediate";
  return "text-risk-low";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── health advice per risk level ──────────────────────────────────────────────

const ADVICE: Record<RiskLevel, { heading: string; tips: string[] }> = {
  low: {
    heading: "Keep up the good work",
    tips: [
      "Maintain a balanced diet rich in vegetables, whole grains, and lean proteins.",
      "Stay physically active — aim for at least 30 minutes of walking most days.",
      "Limit sugary drinks and processed snacks.",
      "Schedule routine medical check-ups at least once a year.",
    ],
  },
  intermediate: {
    heading: "Lifestyle improvements recommended",
    tips: [
      "Reduce intake of sugary foods, white rice, and processed carbohydrates.",
      "Aim for 150+ minutes of intermediate physical activity per week.",
      "Monitor your weight and blood pressure regularly.",
      "Consider a fasting blood glucose test at your next clinic visit.",
      "Schedule a follow-up check-up within the next 3–6 months.",
    ],
  },
  high: {
    heading: "Immediate lifestyle changes advised",
    tips: [
      "Prioritise a low-glycaemic diet — cut sugars, refined carbs, and fried foods.",
      "Increase physical activity gradually — even short daily walks help.",
      "Work with your clinician on a structured diabetes prevention plan.",
      "Consider regular blood glucose monitoring as part of ongoing care.",
      "Follow up with your care team as soon as possible.",
    ],
  },
};

// ── main component ────────────────────────────────────────────────────────────

export function ResultClient() {
  const pathname = usePathname();
  const id = pathname.split("/").pop() ?? "";
  const router = useRouter();
  const { token, user, isHydrated } = useAuthStore();
  const [record, setRecord] = useState<PredictionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    const stored = sessionStorage.getItem(`pred_${id}`);
    if (stored) {
      setRecord(JSON.parse(stored) as PredictionRecord);
      setLoading(false);
      return;
    }
    if (!isHydrated) return; // keep spinner until auth store is ready
    if (!token) {
      setLoading(false);
      return;
    }
    getRecord(token, id)
      .then((r) => setRecord(apiToLocal(r, id)))
      .catch(() => setRecord(null))
      .finally(() => setLoading(false));
  }, [id, token, isHydrated]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-muted-foreground text-sm">Record not found.</p>
      </div>
    );
  }

  const colour = riskCss(record.riskLevel);
  const advice = ADVICE[record.riskLevel];

  return (
    <div className="flex flex-col max-w-lg mx-auto min-h-full bg-muted print:bg-white print:max-w-none">

      {/* ── Top bar (screen only) ── */}
      <div className="flex items-center gap-3 px-4 pt-8 pb-4 bg-surface border-b border-border print:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="h-11 w-11 flex items-center justify-center -ml-2 shrink-0"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground">Screening result</h1>
          <p className="text-sm text-muted-foreground font-mono tracking-wider">ID: {patientId(id)}</p>
        </div>
        <button
          type="button"
          onClick={() => toast.info("Share coming soon")}
          className="h-11 w-11 flex items-center justify-center shrink-0"
        >
          <Share2 className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* ── Report header (print only) ── */}
      <div className="hidden print:flex items-center gap-3 px-4 pt-4 pb-4 border-b border-border">
        <div className="relative h-10 w-10 shrink-0">
          <Image
            src="/logos/SukaaliCheck.png"
            alt="SukaaliCheck"
            fill
            sizes="40px"
            className="object-contain"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-foreground leading-tight">SukaaliCheck</p>
          <p className="text-xs text-muted-foreground">Diabetes type 2 risk screening report</p>
        </div>
        <div className="text-right shrink-0">
          {user?.facility && (
            <p className="text-sm font-semibold text-foreground">{user.facility}</p>
          )}
          <p className="text-xs text-muted-foreground font-mono tracking-wider">
            ID: {patientId(id)}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(record.createdAt)}</p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-col gap-4 px-4 pt-4 pb-10 print:gap-3 print:pt-3 print:pb-0">

        {/* Risk level card */}
        <div
          className="rounded-card border border-border bg-surface overflow-hidden print:break-inside-avoid"
          style={{ borderTop: `4px solid ${colour}` }}
        >
          <div className="p-4 flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Risk level
            </p>
            <p className="text-[26px] font-extrabold leading-tight">
              <span className={riskTextClass(record.riskLevel)}>
                {riskLabel(record.riskLevel)}
              </span>
              <span className="text-muted-foreground font-normal text-xl">
                {" · "}{record.riskScore}%
              </span>
            </p>
            <div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${record.riskScore}%`, backgroundColor: colour }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground">Lower</span>
                <span className="text-xs text-muted-foreground">Higher</span>
              </div>
            </div>
          </div>
        </div>

        {/* Amber disclaimer */}
        <div className="rounded-card bg-amber-50 border border-amber-200 p-4 flex gap-3 print:break-inside-avoid">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 leading-relaxed">
            <span className="font-bold">Screening estimate only.</span>{" "}
            This is not a medical diagnosis. Clinical judgement should guide next steps.
          </p>
        </div>

        {/* Health advice */}
        <Card className="print:break-inside-avoid">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm font-semibold text-foreground">{advice.heading}</p>
            </div>
            <ul className="flex flex-col gap-2.5">
              {advice.tips.map((tip) => (
                <li key={tip} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                  <span
                    className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: colour }}
                  />
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Contributing factors */}
        {record.keyFactors && record.keyFactors.length > 0 && (
          <Card className="print:break-inside-avoid">
            <CardContent className="pt-4 pb-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Contributing factors
              </p>
              <ul className="flex flex-col gap-2">
                {record.keyFactors.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: colour }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Patient summary (collapsible) */}
        <Card className="print:break-inside-avoid">
          <button
            type="button"
            onClick={() => setSummaryOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3.5 text-left min-h-[52px]"
          >
            <span className="text-sm font-semibold text-foreground">Patient summary</span>
            <span className="print:hidden">
              {summaryOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
          </button>
          <CardContent
            className={cn(
              "pt-0 pb-4 border-t border-border flex-col gap-0 print:flex",
              summaryOpen ? "flex" : "hidden",
            )}
          >
              {(
                [
                  ["Patient ID", patientId(id)],
                  ["Age", `${record.age} years`],
                  ["Sex", record.sex],
                  ["Risk score", `${record.riskScore}%`],
                  ["Date", formatDate(record.createdAt)],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between text-sm py-2.5 border-b border-border last:border-0"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn("font-medium text-foreground", label === "Patient ID" && "font-mono tracking-wider")}>{value}</span>
                </div>
              ))}
            </CardContent>
        </Card>

        {/* Print-only disclaimer footer */}
        <p className="hidden print:block text-xs text-muted-foreground leading-relaxed pt-2 print:break-inside-avoid">
          This report is a screening estimate generated by SukaaliCheck and is not a medical
          diagnosis. It should not replace evaluation by a qualified clinician.
        </p>

        {/* Actions */}
        <Button
          size="lg"
          className="w-full print:hidden"
          onClick={() => window.print()}
        >
          <Download className="h-4 w-4" />
          Download PDF report
        </Button>

        {/* <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="w-full h-11 text-sm font-semibold text-primary flex items-center justify-center"
        >
          Save and finish
        </button> */}
      </div>
    </div>
  );
}
