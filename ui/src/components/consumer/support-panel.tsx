"use client";

import { Mail, HelpCircle } from "lucide-react";

const FAQS = [
  {
    q: "How do I sync my bank transactions?",
    a: "Go to Wallet → Re-sync via AA to pull your latest transactions from your bank.",
  },
  {
    q: "Why is my wallet balance not updating?",
    a: "Click Re-sync via AA on the Wallet page to fetch the latest data from your bank.",
  },
  {
    q: "How does Cartis calculate my income tax?",
    a: "From your financial profile (income, tax deducted, investments) using the new-regime slabs. It's an estimate — your CA's word is final.",
  },
  {
    q: "Is my data secure?",
    a: "We access your bank data only through Account Aggregator with your explicit consent. We never get your passwords or OTPs.",
  },
];

export function SupportPanel() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Support</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">We reply fast, usually within a day.</p>
      </div>

      <div className="flex flex-col gap-2">
        <a
          href="mailto:support@cartis.app"
          className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/50 px-3 py-2.5 text-[13px] text-foreground transition-colors hover:border-primary/40"
        >
          <Mail className="h-4 w-4 text-primary" />
          support@cartis.app
        </a>
      </div>

      <div className="flex flex-col gap-3">
        {FAQS.map((f) => (
          <div key={f.q} className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <HelpCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {f.q}
            </span>
            <span className="text-[12px] leading-relaxed text-muted-foreground">{f.a}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
