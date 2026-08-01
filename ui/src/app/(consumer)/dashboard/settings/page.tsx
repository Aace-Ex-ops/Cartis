"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { gql } from "@/lib/gql";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

function SettingToggle({ title, desc, defaultOn }: { title: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] text-foreground">{title}</span>
        <span className="text-[12px] text-muted-foreground">{desc}</span>
      </div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}

type SettingsData = {
  me: { fullName: string; email: string };
  monthlyTab: { limit: number };
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [budget, setBudget] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void gql<SettingsData>(`{ me { fullName email } monthlyTab { limit } }`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setBudget(String(Math.round(d.monthlyTab.limit)));
      })
      .catch(() => {
        if (!cancelled) setData({ me: { fullName: "", email: "" }, monthlyTab: { limit: 0 } });
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

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your preferences, your alerts.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in with Google</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[14px] font-medium text-foreground">{data?.me.fullName ?? "…"}</span>
            <span className="text-[12px] text-muted-foreground">{data?.me.email ?? ""}</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`${GATEWAY}/auth/start?provider=google`}>Re-connect</a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budget preference</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor="budget">Monthly budget (₹)</Label>
          <div className="flex max-w-64 gap-2">
            <Input
              id="budget"
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
          <SettingToggle title="Email" desc="Weekly digest with spending summary" defaultOn={false} />
        </CardContent>
      </Card>
    </div>
  );
}
