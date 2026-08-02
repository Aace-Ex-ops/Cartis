"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import Stepper, { Step } from "@/components/shared/stepper";

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

function StepHeading({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function OnboardingForm() {
  const [bank, setBank] = useState("");
  const [mobile, setMobile] = useState("");
  const router = useRouter();

  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi Cartis, I bank with ${bank || "my bank"} and want to sync my transactions.`
  )}`;

  return (
    <Stepper
      onFinalStepCompleted={() => router.push("/dashboard")}
      backButtonText="Back"
      nextButtonText="Continue"
      contentClassName="min-h-[190px]"
    >
      <Step>
        <StepHeading
          title="Step 1 · Your bank"
          body="Cartis reads your bank alerts over WhatsApp. We never get your passwords."
        />
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
      </Step>

      <Step>
        <StepHeading
          title="Step 2 · Your number"
          body="The number where your bank sends transaction alerts."
        />
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

        <Button asChild className="mt-4 w-full" disabled={!bank || mobile.length !== 10}>
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" />
            Continue on WhatsApp
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </Step>

      <Step>
        <StepHeading
          title="Step 3 · Connect your account"
          body="Paste a bank SMS to connect your account and jump into your dashboard."
        />
        <SyncPasteBox bank={bank} mobile={mobile} onSynced={() => router.push("/dashboard")} />
      </Step>
    </Stepper>
  );
}
