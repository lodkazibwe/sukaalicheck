"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  MOCK_RECORDS,
  todayRecords,
  thisWeekRecords,
  type RiskLevel,
  type PredictionRecord,
} from "@/lib/mock";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { cn, patientId } from "@/lib/utils";

type RiskFilter = "all" | RiskLevel;
type DateFilter = "all" | "today" | "week";

function formatRow(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  const time = d.toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" });

  if (d.toDateString() === today.toDateString()) return `Today · ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  if (d.toDateString() === twoDaysAgo.toDateString()) return `2 days ago · ${time}`;
  return d.toLocaleDateString("en-UG", { day: "numeric", month: "short" }) + ` · ${time}`;
}

export default function RecordsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");

  const filtered = useMemo<PredictionRecord[]>(() => {
    let records: PredictionRecord[] = MOCK_RECORDS;

    if (dateFilter === "today") records = todayRecords(records);
    else if (dateFilter === "week") records = thisWeekRecords(records);

    if (riskFilter !== "all")
      records = records.filter((r) => r.riskLevel === riskFilter);

    if (search.trim()) {
      const q = search.trim().toUpperCase();
      records = records.filter((r) => patientId(r.id).includes(q));
    }

    return records;
  }, [search, riskFilter, dateFilter]);

  return (
    <div className="flex flex-col max-w-lg mx-auto min-h-full bg-muted">
      {/* ── Top bar ── */}
      <div className="flex items-start gap-2 px-4 pt-8 pb-4 bg-surface border-b border-border">
        <button
          type="button"
          onClick={() => router.back()}
          className="h-11 w-11 flex items-center justify-center -ml-2 shrink-0"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground">Records</h1>
          <p className="text-sm text-muted-foreground">{MOCK_RECORDS.length} predictions</p>
        </div>
        <button
          type="button"
          className="h-11 w-11 flex items-center justify-center shrink-0"
        >
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4 pb-4">
        {/* ── Search ── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by patient ID"
            className="pl-9 bg-surface"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* ── Risk filter chips ── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {(
            [
              { label: "All", value: "all" },
              { label: "High", value: "high" },
              { label: "Intermediate", value: "intermediate" },
              { label: "Low", value: "low" },
            ] as { label: string; value: RiskFilter }[]
          ).map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRiskFilter(value)}
              className={cn(
                "h-8 px-3.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap shrink-0 border",
                riskFilter === value
                  ? "bg-primary border-primary text-white"
                  : "bg-surface border-border text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Date filter chips ── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {(
            [
              { label: "Today", value: "today" },
              { label: "This week", value: "week" },
              { label: "All time", value: "all" },
            ] as { label: string; value: DateFilter }[]
          ).map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => setDateFilter(value)}
              className={cn(
                "h-8 px-3.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap shrink-0 border",
                dateFilter === value
                  ? "bg-foreground border-foreground text-surface"
                  : "bg-surface border-border text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── List ── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">No predictions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search || riskFilter !== "all" || dateFilter !== "all"
                ? "Try adjusting your filters."
                : "Submit your first prediction to see it here."}
            </p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {filtered.map((record) => (
                <Link
                  key={record.id}
                  href={`/predict/result/${record.id}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-muted transition-colors min-h-[60px]"
                >
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-foreground font-semibold text-xs shrink-0 font-mono">
                    {patientId(record.id).slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate font-mono tracking-wider">
                      {patientId(record.id)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {record.age} · {record.sex} · {formatRow(record.createdAt)}
                    </p>
                  </div>
                  <RiskBadge level={record.riskLevel} size="sm" />
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
