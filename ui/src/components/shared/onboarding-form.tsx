"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AaConnect } from "@/components/consumer/aa-connect";
import Stepper, { Step } from "@/components/shared/stepper";
import { gql } from "@/lib/gql";

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
  const [role, setRole] = useState<"consumer" | "seller">("consumer");
  const [synced, setSynced] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profile, setProfile] = useState({
    monthlyIncome: "",
    monthlySpend: "",
    investmentPct: "",
    housingCost: "",
    dependents: "",
    debtEmis: "",
    monthlyTax: "",
  });
  const [business, setBusiness] = useState({
    name: "",
    monthlyRevenue: "",
    monthlyExpenses: "",
  });
  const router = useRouter();

  async function saveProfile() {
    const fields: string[] = [];
    if (profile.monthlyIncome) fields.push(`monthlyIncome: ${profile.monthlyIncome}`);
    if (profile.monthlySpend) fields.push(`monthlySpend: ${profile.monthlySpend}`);
    if (profile.investmentPct) fields.push(`investmentPct: ${profile.investmentPct}`);
    if (profile.housingCost) fields.push(`housingCost: ${profile.housingCost}`);
    if (profile.dependents) fields.push(`dependents: ${profile.dependents}`);
    if (profile.debtEmis) fields.push(`debtEmis: ${profile.debtEmis}`);
    if (profile.monthlyTax) fields.push(`monthlyTax: ${profile.monthlyTax}`);
    if (fields.length > 0) {
      await gql<{ updateFinancialProfile: unknown }>(
        `mutation { updateFinancialProfile(${fields.join(", ")}) { id } }`
      );
    }
  }

  async function saveSeller() {
    if (role !== "seller") return;
    const name = business.name.trim();
    const revenue = Number(business.monthlyRevenue);
    const expenses = Number(business.monthlyExpenses);
    await gql<{ updateUserType: unknown }>(
      `mutation { updateUserType(userType: "business"${name ? `, businessName: ${JSON.stringify(name)}` : ""}) { id } }`
    );
    const today = new Date().toISOString().slice(0, 10);
    if (Number.isFinite(revenue) && revenue > 0) {
      await gql(
        `mutation { addFinanceEntry(input: { entryType: "revenue", amount: ${revenue}, category: "Product sales", description: "Opening balance (onboarding)", transactionDate: "${today}" }) { entryId } }`
      );
    }
    if (Number.isFinite(expenses) && expenses > 0) {
      await gql(
        `mutation { addFinanceEntry(input: { entryType: "expense", amount: ${expenses}, category: "Other", description: "Opening balance (onboarding)", transactionDate: "${today}" }) { entryId } }`
      );
    }
  }

  async function finish() {
    setProfileSaving(true);
    try {
      await saveProfile();
      await saveSeller();
    } catch {
      // non-critical — proceed anyway
    }
    router.push(role === "seller" ? "/seller/dashboard" : "/dashboard");
  }

  const finishLazy = () => router.push(role === "seller" ? "/seller/dashboard" : "/dashboard");

  return (
    <Stepper
      onFinalStepCompleted={() => void finish()}
      backButtonText="Back"
      nextButtonText="Continue"
      contentClassName="min-h-[190px]"
    >
      <Step>
        <StepHeading
          title="Step 1 · Who are you?"
          body="Personal finance, or run a business too? You can switch anytime."
        />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole("consumer")}
            className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
              role === "consumer"
                ? "border-primary bg-primary/10"
                : "border-border/50 bg-background/50 hover:border-border"
            }`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${role === "consumer" ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-muted-foreground"}`}>
              <User className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[14px] font-medium text-foreground">Personal finance</span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">Budget, spend, save & invest</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setRole("seller")}
            className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
              role === "seller"
                ? "border-primary bg-primary/10"
                : "border-border/50 bg-background/50 hover:border-border"
            }`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${role === "seller" ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-muted-foreground"}`}>
              <Store className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[14px] font-medium text-foreground">Business + personal</span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">Everything, plus P&L, GST & inventory</span>
            </span>
          </button>
        </div>
      </Step>

      <Step>
        <StepHeading
          title="Step 2 · Connect your bank"
          body="Select a demo persona to link your bank account. No passwords needed."
        />
        <AaConnect onSynced={() => setSynced(true)} />
        {synced && (
          <p className="mt-2 text-center text-sm text-green-600">Account connected!</p>
        )}
      </Step>

      {role === "seller" ? (
        <Step>
          <StepHeading
            title="Step 3 · Your business"
            body="Starting numbers for your business dashboard. All optional — you can add entries anytime."
          />
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="onb-biz-name" className="text-xs text-muted-foreground">Business name</Label>
              <Input
                id="onb-biz-name"
                placeholder="e.g. Shree Textiles"
                value={business.name}
                onChange={(e) => setBusiness((b) => ({ ...b, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="onb-biz-rev" className="text-xs text-muted-foreground">Monthly revenue (₹)</Label>
                <Input
                  id="onb-biz-rev"
                  type="number"
                  placeholder="e.g. 120000"
                  value={business.monthlyRevenue}
                  onChange={(e) => setBusiness((b) => ({ ...b, monthlyRevenue: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="onb-biz-exp" className="text-xs text-muted-foreground">Monthly expenses (₹)</Label>
                <Input
                  id="onb-biz-exp"
                  type="number"
                  placeholder="e.g. 65000"
                  value={business.monthlyExpenses}
                  onChange={(e) => setBusiness((b) => ({ ...b, monthlyExpenses: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </Step>
      ) : null}

      <Step>
        <StepHeading
          title={role === "seller" ? "Step 4 · Your money" : "Step 3 · Your money"}
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
          <div className="flex flex-col gap-1">
            <Label htmlFor="onb-tax" className="text-xs text-muted-foreground">Monthly tax deducted (₹)</Label>
            <Input id="onb-tax" type="number" placeholder="e.g. 12000" value={profile.monthlyTax} onChange={(e) => setProfile((p) => ({ ...p, monthlyTax: e.target.value }))} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={finishLazy}
          >
            Skip for now
          </Button>
          <Button
            className="flex-1"
            disabled={profileSaving}
            onClick={() => void finish()}
          >
            {profileSaving ? "Saving…" : "Save & continue"}
          </Button>
        </div>
      </Step>
    </Stepper>
  );
}
