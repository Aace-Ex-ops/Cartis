"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { gql } from "@/lib/gql";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

function SettingToggle({ title, desc, defaultOn, onCheckedChange }: { title: string; desc: string; defaultOn: boolean; onCheckedChange?: (v: boolean) => void }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] text-foreground">{title}</span>
        <span className="text-[12px] text-muted-foreground">{desc}</span>
      </div>
      <Switch checked={on} onCheckedChange={(v) => { setOn(v); onCheckedChange?.(v); }} />
    </div>
  );
}

type SettingsData = {
  me: {
    fullName: string;
    email: string;
    monthlyIncome: number | null;
    monthlySpend: number | null;
    investmentPct: number | null;
    housingCost: number | null;
    dependents: number | null;
    debtEmis: number | null;
    monthlyTax: number | null;
    emailNotifications: boolean;
  };
  monthlyTab: { limit: number };
};

export function SettingsPanel() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [budget, setBudget] = useState("");
  const [saved, setSaved] = useState(false);

  const [profile, setProfile] = useState({
    monthlyIncome: "",
    monthlySpend: "",
    investmentPct: "",
    housingCost: "",
    dependents: "",
    debtEmis: "",
    monthlyTax: "",
  });
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void gql<SettingsData>(
      `{ me { fullName email monthlyIncome monthlySpend investmentPct housingCost dependents debtEmis monthlyTax emailNotifications } monthlyTab { limit } }`
    )
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setBudget(String(Math.round(d.monthlyTab.limit)));
        setProfile({
          monthlyIncome: d.me.monthlyIncome != null ? String(d.me.monthlyIncome) : "",
          monthlySpend: d.me.monthlySpend != null ? String(d.me.monthlySpend) : "",
          investmentPct: d.me.investmentPct != null ? String(d.me.investmentPct) : "",
          housingCost: d.me.housingCost != null ? String(d.me.housingCost) : "",
          dependents: d.me.dependents != null ? String(d.me.dependents) : "",
          debtEmis: d.me.debtEmis != null ? String(d.me.debtEmis) : "",
          monthlyTax: d.me.monthlyTax != null ? String(d.me.monthlyTax) : "",
        });
      })
      .catch(() => {
        if (!cancelled) setData({ me: { fullName: "", email: "", monthlyIncome: null, monthlySpend: null, investmentPct: null, housingCost: null, dependents: null, debtEmis: null, monthlyTax: null, emailNotifications: true }, monthlyTab: { limit: 0 } });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveBudget() {
    const limit = Number(budget);
    if (!Number.isFinite(limit) || limit <= 0) return;
    setSaved(false);
    try {
      await gql<{ setMonthlyTabLimit: { limit: number } }>(
        `mutation { setMonthlyTabLimit(limit: ${limit}) { limit } }`,
      );
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  async function saveProfile() {
    setProfileSaved(false);
    try {
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
          `mutation { updateFinancialProfile(${fields.join(", ")}) { id } }`,
        );
      }
      fetch(`${GATEWAY}/api/budget/cache/clear`, { method: "POST", credentials: "include" }).catch(() => {});
      setProfileSaved(true);
    } catch {
      setProfileSaved(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your preferences, your alerts.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in with Google</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col">
            <span className="text-[14px] font-medium text-foreground">{data?.me.fullName ?? "…"}</span>
            <span className="text-[12px] text-muted-foreground">{data?.me.email ?? ""}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budget preference</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor="budget-limit">Monthly budget (₹)</Label>
          <div className="flex max-w-64 gap-2">
            <Input
              id="budget-limit"
              type="number"
              value={budget}
              onChange={(e) => {
                setBudget(e.target.value);
                setSaved(false);
              }}
            />
            <Button onClick={saveBudget} disabled={!budget || saved}>
              {saved ? "Saved" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial profile</CardTitle>
          <CardDescription>Used by the AI budget coach to personalize your monthly limit.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="sp-income" className="text-xs text-muted-foreground">Monthly income (₹)</Label>
              <Input id="sp-income" type="number" placeholder="e.g. 80000" value={profile.monthlyIncome} onChange={(e) => { setProfile((p) => ({ ...p, monthlyIncome: e.target.value })); setProfileSaved(false); }} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sp-spend" className="text-xs text-muted-foreground">Monthly spending (₹)</Label>
              <Input id="sp-spend" type="number" placeholder="e.g. 40000" value={profile.monthlySpend} onChange={(e) => { setProfile((p) => ({ ...p, monthlySpend: e.target.value })); setProfileSaved(false); }} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sp-invest" className="text-xs text-muted-foreground">Save/invest (%)</Label>
              <Input id="sp-invest" type="number" placeholder="e.g. 20" value={profile.investmentPct} onChange={(e) => { setProfile((p) => ({ ...p, investmentPct: e.target.value })); setProfileSaved(false); }} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sp-housing" className="text-xs text-muted-foreground">Rent/EMI (₹)</Label>
              <Input id="sp-housing" type="number" placeholder="e.g. 15000" value={profile.housingCost} onChange={(e) => { setProfile((p) => ({ ...p, housingCost: e.target.value })); setProfileSaved(false); }} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sp-dependents" className="text-xs text-muted-foreground">Household size</Label>
              <Input id="sp-dependents" type="number" placeholder="e.g. 3" value={profile.dependents} onChange={(e) => { setProfile((p) => ({ ...p, dependents: e.target.value })); setProfileSaved(false); }} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sp-debt" className="text-xs text-muted-foreground">Total loans (₹)</Label>
              <Input id="sp-debt" type="number" placeholder="e.g. 10000" value={profile.debtEmis} onChange={(e) => { setProfile((p) => ({ ...p, debtEmis: e.target.value })); setProfileSaved(false); }} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sp-tax" className="text-xs text-muted-foreground">Monthly tax deducted (₹)</Label>
              <Input id="sp-tax" type="number" placeholder="e.g. 12000" value={profile.monthlyTax} onChange={(e) => { setProfile((p) => ({ ...p, monthlyTax: e.target.value })); setProfileSaved(false); }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={saveProfile} disabled={profileSaved}>
              {profileSaved ? "Saved" : "Save profile"}
            </Button>
            {profileSaved && <span className="text-sm text-green-600">Profile updated.</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alert preferences</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border/50">
          <SettingToggle title="Big purchase alerts" desc="Flag any product above 20% of monthly budget" defaultOn />
          <SettingToggle title="Low balance alerts" desc="Warn when balance drops below ₹5,000" defaultOn />
          <SettingToggle title="Budget overshoot" desc="Alert before you cross the monthly budget" defaultOn />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification channels</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border/50">
          <SettingToggle title="WhatsApp" desc="Send verdicts and alerts over WhatsApp" defaultOn />
          <SettingToggle title="Email" desc="Weekly digest with spending summary" defaultOn={data?.me.emailNotifications ?? true}
            onCheckedChange={async (v) => {
              try { await gql<unknown>(`mutation { updateFinancialProfile(emailNotifications: ${v}) { id } }`); } catch {}
            }} />
        </CardContent>
      </Card>
    </div>
  );
}
