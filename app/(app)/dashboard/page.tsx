"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Plus } from "lucide-react";

import { useAuthStore } from "@/stores/auth";
import {
  MOCK_RECORDS,
  MOCK_STAFF,
  daysUntil,
  todayRecords,
  thisWeekRecords,
} from "@/lib/mock";
import { Card, CardContent } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { cn, patientId } from "@/lib/utils";

function staffInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatRow(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today · ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  return d.toLocaleDateString("en-UG", { day: "numeric", month: "short" });
}

function SubscriptionLine() {
  const days = daysUntil(MOCK_STAFF.subscriptionExpiry);
  const expired = MOCK_STAFF.subscriptionStatus === "expired" || days <= 0;
  const expiring = !expired && days <= 7;

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          expired ? "bg-danger" : expiring ? "bg-amber-500" : "bg-primary"
        )}
      />
      <p
        className={cn(
          "text-sm font-medium",
          expired ? "text-danger" : expiring ? "text-amber-600" : "text-primary"
        )}
      >
        {expired
          ? "Subscription expired"
          : `Active · expires in ${days} days`}
      </p>
      <span className="ml-auto text-sm text-muted-foreground">
        {MOCK_STAFF.plan}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const todayCount = todayRecords(MOCK_RECORDS).length;
  const weekRecords = thisWeekRecords(MOCK_RECORDS);
  const weekCount = weekRecords.length;
  const highRiskCount = weekRecords.filter((r) => r.riskLevel === "high").length;
  const recent = MOCK_RECORDS.slice(0, 5);
  const userInitials = staffInitials(user?.name ?? "Staff User");

  return (
    <div className="flex flex-col max-w-lg mx-auto bg-surface min-h-full">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-3">
        <div className="relative h-10 w-10 shrink-0">
          <Image
            src="/logos/SukaaliCheck.png"
            alt="SukaaliCheck"
            fill
            sizes="40px"
            className="object-contain"
            priority
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base text-foreground leading-tight truncate">
            {user?.facility ?? MOCK_STAFF.facility}
          </p>
          <p className="text-xs text-muted-foreground">
            Facility · {user?.facilityId ?? MOCK_STAFF.facilityId}
          </p>
        </div>
        <div className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-foreground">{userInitials}</span>
        </div>
      </div>

      {/* ── Subscription status ── */}
      <SubscriptionLine />

      {/* ── New prediction CTA ── */}
      <div className="px-4 mt-3 mb-4">
        <Link
          href="/predict"
          className="flex items-center gap-4 rounded-card bg-primary px-5 py-4 active:opacity-90 transition-opacity"
        >
          <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Plus className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-base leading-tight">
              New patient prediction
            </p>
            <p className="text-sm text-white/80 mt-0.5 leading-snug">
              Enter patient details and run the screening
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/70 shrink-0" />
        </Link>
      </div>

      {/* ── Stat cards ── */}
      <div className="px-4 flex gap-3 mb-5">
        <Card className="flex-1">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-foreground">{todayCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Today</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-foreground">{weekCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">This week</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-3">
            <p className={cn("text-2xl font-bold", highRiskCount > 0 ? "text-danger" : "text-foreground")}>
              {highRiskCount}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">High-risk · wk</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent predictions ── */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">Recent predictions</h2>
          <Link
            href="/records"
            className="text-sm text-primary font-medium min-h-[44px] flex items-center"
          >
            See all
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No predictions yet
          </p>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {recent.map((record) => (
                <Link
                  key={record.id}
                  href={`/predict/result/${record.id}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-muted transition-colors min-h-[56px]"
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
