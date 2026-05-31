"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── Diabetes facts ────────────────────────────────────────────────────────────

const FACTS = [
  {
    headline: "Small changes go a long way",
    body: "Losing just 5–7% of body weight can dramatically reduce diabetes risk.",
  },
  {
    headline: "Family history matters",
    body: "Having a first-degree relative with diabetes means your risk can be 2–6× higher.",
  },
  {
    headline: "Silent epidemic",
    body: "Up to 50% of people with type 2 diabetes don't know they have it.",
  },
  {
    headline: "Uganda is at risk",
    body: "Over 1.4 million Ugandans are estimated to be living with diabetes, many undiagnosed.",
  },
  {
    headline: "Move more, risk less",
    body: "Just 30 minutes of brisk walking, 5 days a week, can cut diabetes risk by up to 58%.",
  },
  {
    headline: "Early detection changes outcomes",
    body: "Type 2 diabetes caught early can be managed or even reversed with lifestyle changes.",
  },
];

// ── Partner orgs ──────────────────────────────────────────────────────────────

const PARTNERS = [
  { name: "Pathogen Economy Labs", logo: "/logos/Pathogen_economy.jpeg" },
  { name: "MARCONI Labs",          logo: "/logos/marconi_labs.png" },
  { name: "Makerere University",   logo: "/logos/Makerere_University.jpeg" },
  { name: "STI Secretariat",       logo: "/logos/STI.jpeg" },
];

// ── Rotating facts card ───────────────────────────────────────────────────────

function FactsCarousel() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % FACTS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const fact = FACTS[idx];

  return (
    <div className="mx-4">
      <div className="rounded-card bg-primary p-5 flex flex-col gap-3 min-h-[160px]">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
          Did you know?
        </p>
        <p className="text-lg font-bold text-white leading-snug">{fact.headline}</p>
        <p className="text-sm text-white/85 leading-relaxed">{fact.body}</p>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5 mt-1">
          {FACTS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === idx ? "w-5 bg-white" : "w-1.5 bg-white/40"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="flex flex-col max-w-lg mx-auto min-h-screen bg-surface">

      {/* ── Nav bar ── */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-6">
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
        <span className="font-bold text-lg text-foreground">SukaaliCheck</span>
      </div>

      {/* ── Hero ── */}
      <div className="px-4 pb-8 flex flex-col gap-4">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          For Medical &amp; herbal facilities · Uganda
        </p>
        <h1 className="text-3xl font-extrabold text-foreground leading-tight">
         AI-assisted diabetes type 2 predictor, in minutes
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Enter a patient&apos;s vitals, get an instant risk estimate, and generate a
          referral-ready report. Built for frontline health workers across Uganda.
        </p>

        <div className="flex flex-col gap-3 mt-2">
          <Button size="lg" className="w-full" asChild>
            <Link href="/signup">Sign up your facility</Link>
          </Button>
          <Button size="lg" variant="outline" className="w-full" asChild>
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="px-4 pb-8 flex flex-col gap-4">
        <h2 className="text-xl font-bold text-foreground">How it works</h2>
        {[
          {
            n: 1,
            title: "Enter patient vitals",
            body: "A guided form captures age, BMI, glucose and lifestyle in under 2 minutes.",
          },
          {
            n: 2,
            title: "Get an instant risk estimate",
            body: "Our model returns a low / intermediate / high score with explainable factors.",
          },
          {
            n: 3,
            title: "Refer or follow up",
            body: "Download a clinic-ready PDF or save the record for later review.",
          },
        ].map(({ n, title, body }) => (
          <div key={n} className="flex items-start gap-4">
            <div className="h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm font-bold text-primary">{n}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Did you know carousel ── */}
      <div className="pb-8">
        <FactsCarousel />
      </div>

      {/* ── Built with ── */}
      <div className="px-4 pb-8 flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Built with</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Funded and mentored by:</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PARTNERS.map(({ name, logo }) => (
            <Card key={name} className="flex items-center gap-3 p-3">
              <div className="relative h-10 w-10 shrink-0">
                <Image
                  src={logo}
                  alt={name}
                  fill
                  sizes="40px"
                  className="object-contain"
                />
              </div>
              <span className="text-sm font-medium text-foreground leading-snug">{name}</span>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Contact us ── */}
      <div className="px-4 pb-8 flex flex-col gap-4">
        <h2 className="text-xl font-bold text-foreground">Contact us</h2>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {[
              { label: "EMAIL", value: "sukaalicheckug@gmail.com", href: "mailto:sukaalicheckug@gmail.com" },
              { label: "EMAIL", value: "hellennakabuye23@gmail.com", href: "mailto:hellennakabuye23@gmail.com" },
              { label: "PHONE", value: "+256 703 145 793", href: "tel:+256703145793" },
            ].map(({ label, value, href }, i) => (
              <a
                key={i}
                href={href}
                className="flex items-center justify-between px-4 py-3.5 min-h-[52px] active:bg-muted transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {label}
                </span>
                <span className="text-sm font-medium text-foreground text-right">{value}</span>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Footer CTA + copyright ── */}
      <div className="px-4 pb-10 flex flex-col gap-4 mt-2">
        <Button size="lg" className="w-full" asChild>
          <Link href="/signup">Sign up your facility</Link>
        </Button>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">© 2026 SukaaliCheck</p>
          <p className="text-xs text-muted-foreground">Made in Kampala, Uganda</p>
        </div>
      </div>

    </div>
  );
}
