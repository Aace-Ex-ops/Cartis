"use client";

import { useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SyncPasteBox } from "@/components/shared/sync-paste-box";

const BANKS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "IDBI Bank",
  "Yes Bank",
  "IndusInd Bank",
  "Federal Bank",
  "IDFC First Bank",
  "Indian Bank",
  "Indian Overseas Bank",
  "Bandhan Bank",
  "AU Small Finance Bank",
  "Ujjivan Small Finance Bank",
  "DBS Bank",
  "RBL Bank",
];

const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "910000000000";

export function OnboardingForm() {
  const [bank, setBank] = useState("");
  const [mobile, setMobile] = useState("");

  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi Cartis, I bank with ${bank || "my bank"} and want to sync my transactions.`
  )}`;

    return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Step 1 · Your bank
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cartis reads your bank alerts over WhatsApp. We never get your
            passwords.
          </p>
        </div>

        <Select value={bank} onValueChange={setBank}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select your bank" />
          </SelectTrigger>
          <SelectContent>
            {BANKS.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Step 2 · Your number
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The number where your bank sends transaction alerts.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex items-center rounded-md border border-border/50 bg-background/50 px-3 text-sm text-muted-foreground">
            +91
          </div>
          <Input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
        </div>

        <Button asChild className="w-full" disabled={!bank || mobile.length !== 10}>
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" />
            Continue on WhatsApp
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </section>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/50" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
          or sync manually
        </span>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      <section className="flex flex-col gap-3">
        <label
          htmlFor="paste-box"
          className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/60"
        >
          Paste bank alerts
        </label>
        <SyncPasteBox bank={bank} />
      </section>
    </div>
  );
}
