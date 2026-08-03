"use client";

import { MessageCircle, Mail, HelpCircle } from "lucide-react";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "910000000000";

const FAQS = [
  {
    q: "How do I sync my bank transactions?",
    a: "Open Wallet → Sync transactions, then paste a bank SMS alert or continue on WhatsApp with your bank's number.",
  },
  {
    q: "Why is my wallet balance not updating?",
    a: "Sync a new bank alert or statement — the balance updates from the latest synced message.",
  },
  {
    q: "How does Cartis calculate my income tax?",
    a: "From your financial profile (income, tax deducted, investments) using the new-regime slabs. It's an estimate — your CA's word is final.",
  },
  {
    q: "Is my data secure?",
    a: "We only read the bank alerts you choose to share. We never get your passwords or OTPs.",
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
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Cartis, I need help.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/50 px-3 py-2.5 text-[13px] text-foreground transition-colors hover:border-primary/40"
        >
          <MessageCircle className="h-4 w-4 text-primary" />
          Chat on WhatsApp
        </a>
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
