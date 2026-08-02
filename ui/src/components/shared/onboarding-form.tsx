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
import { Label } from "@/components/ui/label";
import { SyncPasteBox } from "@/components/shared/sync-paste-box";
import Stepper, { Step } from "@/components/shared/stepper";
import { gql } from "@/lib/gql";

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
  const [synced, setSynced] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profile, setProfile] = useState({
    monthlyIncome: "",
    monthlySpend: "",
    investmentPct: "",
    housingCost: "",
    dependents: "",
    debtEmis: "",
  });
  const router = useRouter();

  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi Cartis, I bank with ${bank || "my bank"} and want to sync my transactions.`
  )}`;

  async function saveProfile() {
    setProfileSaving(true);
    try {
      const fields: string[] = [];
      if (profile.monthlyIncome) fields.push(`monthlyIncome: ${profile.monthlyIncome}`);
      if (profile.monthlySpend) fields.push(`monthlySpend: ${profile.monthlySpend}`);
      if (profile.investmentPct) fields.push(`investmentPct: ${profile.investmentPct}`);
      if (profile.housingCost) fields.push(`housingCost: ${profile.housingCost}`);
      if (profile.dependents) fields.push(`dependents: ${profile.dependents}`);
      if (profile.debtEmis) fields.push(`debtEmis: ${profile.debtEmis}`);
      if (fields.length > 0) {
        await gql<{ updateFinancialProfile: unknown }>(
          `mutation { updateFinancialProfile(${fields.join(", ")}) { id } }`
        );
      }
    } catch {
      // non-critical — proceed anyway
    }
    setProfileSaving(false);
  }

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
          body="Paste a bank SMS to connect your account."
        />
        <SyncPasteBox bank={bank} mobile={mobile} onSynced={() => setSynced(true)} />
        {synced && (
          <p className="mt-2 text-center text-sm text-green-600">Account connected!</p>
        )}
      </Step>

      <Step>
        <StepHeading
          title="Step 4 · Your money"
          body="Help Cartis build a smarter budget. All fields optional — skip if you'd rather not say."
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-income" className="text-xs text-muted-foreground">Monthly income (₹)</Label>
            <Input id="onb-income" type="number" placeholder="e.g. 80000" value={profile.monthlyIncome} onChange={(e) => setProfile((p) => ({ ...p, monthlyIncome: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-spend" className="text-xs text-muted-foreground">Monthly spending (₹)</Label>
            <Input id="onb-spend" type="number" placeholder="e.g. 40000" value={profile.monthlySpend} onChange={(e) => setProfile((p) => ({ ...p, monthlySpend: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-invest" className="text-xs text-muted-foreground">Save/invest (%)</Label>
            <Input id="onb-invest" type="number" placeholder="e.g. 20" value={profile.investmentPct} onChange={(e) => setProfile((p) => ({ ...p, investmentPct: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-housing" className="text-xs text-muted-foreground">Rent/EMI (₹)</Label>
            <Input id="onb-housing" type="number" placeholder="e.g. 15000" value={profile.housingCost} onChange={(e) => setProfile((p) => ({ ...p, housingCost: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-dependents" className="text-xs text-muted-foreground">Household size</Label>
            <Input id="onb-dependents" type="number" placeholder="e.g. 3" value={profile.dependents} onChange={(e) => setProfile((p) => ({ ...p, dependents: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-debt" className="text-xs text-muted-foreground">Total EMIs/loans (₹)</Label>
            <Input id="onb-debt" type="number" placeholder="e.g. 10000" value={profile.debtEmis} onChange={(e) => setProfile((p) => ({ ...p, debtEmis: e.target.value }))} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/dashboard")}
          >
            Skip for now
          </Button>
          <Button
            className="flex-1"
            disabled={profileSaving}
            onClick={saveProfile}
          >
            {profileSaving ? "Saving…" : "Save & continue"}
          </Button>
        </div>
      </Step>
    </Stepper>
  );
}
