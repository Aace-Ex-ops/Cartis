"use client";

import { useState } from "react";
import { CalendarClock, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function newRegimeTax(annual: number): number {
  const taxable = Math.max(0, annual - 75_000);
  if (taxable <= 12_00_000) return 0;
  let tax = 0;
  let income = taxable;
  const bands: [number, number][] = [
    [4_00_000, 0],
    [4_00_000, 0.05],
    [4_00_000, 0.1],
    [4_00_000, 0.15],
    [4_00_000, 0.2],
    [4_00_000, 0.25],
    [Infinity, 0.3],
  ];
  for (const [width, rate] of bands) {
    const take = Math.min(income, width);
    tax += take * rate;
    income -= take;
    if (income <= 0) break;
  }
  return tax * 1.04;
}

const CHECKLIST = [
  "Download Form 16 from your employer (or collect payslips + bank statements if self-employed).",
  "Pull your AIS/TIS statement on the income tax portal and verify TDS credits.",
  "Cross-check income, TDS and deductions you're eligible for (80C, 80D, HRA, etc.).",
  "File on incometax.gov.in — ITR-1 for salary income, online form or Excel utility.",
  "Verify with EVC/Aadhaar OTP and download the acknowledgment (ITR-V).",
];

export function TaxCard({
  monthlyIncome,
  monthlyTax,
}: {
  monthlyIncome: number | null;
  monthlyTax: number | null;
}) {
  const [open, setOpen] = useState(false);

  const annual = monthlyIncome ? monthlyIncome * 12 : 0;
  const tax = annual > 0 ? newRegimeTax(annual) : null;
  const tds = monthlyTax ? monthlyTax * 12 : null;
  const due =
    tds != null && tax != null
      ? tds >= tax
        ? "Covered by TDS"
        : `≈ ${fmt((tax - tds) / 12)} more per month`
      : "Set monthly tax in onboarding";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          Income tax
        </CardTitle>
        <CardDescription className="text-[11px]">New regime · FY 2025-26</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tax == null ? (
          <p className="text-[13px] text-muted-foreground">
            Complete onboarding to estimate your tax.
          </p>
        ) : (
          <>
            <div>
              <div className="text-[24px] font-semibold text-foreground">{fmt(Math.round(tax))}</div>
              <div className="text-[11px] text-muted-foreground">estimated yearly tax</div>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">TDS this year</span>
              <span className="font-medium text-foreground">{tds != null ? fmt(tds) : "—"}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-medium ${tds != null && tax != null && tds < tax ? "text-amber-400" : "text-green-500"}`}>
                {due}
              </span>
            </div>
            <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-[12px] text-amber-400">
              ITR due 31 July 2026 — don&apos;t miss the deadline.
            </p>
          </>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <FileText className="mr-2 h-4 w-4" />
              Filing checklist
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">File your ITR</DialogTitle>
              <DialogDescription className="text-[12px]">
                Steps to file your income tax return for FY 2025-26.
              </DialogDescription>
            </DialogHeader>
            <ol className="flex flex-col gap-3">
              {CHECKLIST.map((step, i) => (
                <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <a
              href="https://www.incometax.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Open incometax.gov.in →
            </a>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
