"use client";

import { useState, useEffect } from "react";
import { Calculator, LineChart, Percent, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";
const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const TABS = [
  { id: "retirement", label: "Retirement", icon: TrendingUp },
  { id: "tax", label: "Tax", icon: Percent },
  { id: "stock", label: "Stocks", icon: LineChart },
];

type Retirement = {
  projected_corpus: number;
  monthly_retirement_income: number;
  monthly_retirement_income_today: number;
  monthly_expense_today: number;
  monthly_shortfall: number;
  required_monthly_sip_for_full_cover: number;
};

type Tax = {
  new_regime_tax: number;
  old_regime_tax: number;
  better_regime: string;
  saving_if_switch: number;
  hra_exemption_used: number;
  s80c_headroom: number;
};

type Stock = {
  symbol: string;
  name?: string;
  close?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  error?: string;
};

function ResultCard({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 p-3">
      <p className="text-[11px] text-muted-foreground">{title}</p>
      <p className="mt-0.5 text-lg font-semibold text-foreground">{value}</p>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

export default function ToolsPage() {
  const [tab, setTab] = useState("retirement");
  useEffect(() => {
    const q = window.location.search;
    if (q.includes("tab=tax")) setTab("tax");
    else if (q.includes("tab=stock")) setTab("stock");
  }, []);
  const [busy, setBusy] = useState(false);

  const [ret, setRet] = useState({ current_age: "30", retire_age: "60", monthly_expense: "50000", monthly_sip: "10000" });
  const [retOut, setRetOut] = useState<Retirement | null>(null);
  const [retErr, setRetErr] = useState("");

  const [tax, setTax] = useState({ annual_income: "1200000", s80c: "150000", basic_da: "60000", hra: "24000", rent_paid: "20000" });
  const [taxOut, setTaxOut] = useState<Tax | null>(null);
  const [taxErr, setTaxErr] = useState("");

  const [symbol, setSymbol] = useState("RELIANCE.NSE");
  const [stock, setStock] = useState<Stock | null>(null);
  const [stockErr, setStockErr] = useState("");

  async function runRetirement() {
    setBusy(true);
    setRetErr("");
    try {
      const res = await fetch(`${GATEWAY}/api/tools/retirement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          current_age: parseFloat(ret.current_age) || undefined,
          retire_age: parseFloat(ret.retire_age) || undefined,
          monthly_expense: parseFloat(ret.monthly_expense) || undefined,
          monthly_sip: parseFloat(ret.monthly_sip) || undefined,
        }),
      });
      const body = (await res.json()) as Retirement | { error: string };
      if (!res.ok || "error" in body) throw new Error((body as { error: string }).error ?? "failed");
      setRetOut(body as Retirement);
    } catch (e) {
      setRetErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runTax() {
    setBusy(true);
    setTaxErr("");
    try {
      const res = await fetch(`${GATEWAY}/api/tools/tax`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          annual_income: parseFloat(tax.annual_income) || undefined,
          s80c: parseFloat(tax.s80c) || undefined,
          basic_da: parseFloat(tax.basic_da) || undefined,
          hra: parseFloat(tax.hra) || undefined,
          rent_paid: parseFloat(tax.rent_paid) || undefined,
        }),
      });
      const body = (await res.json()) as Tax | { error: string };
      if (!res.ok || "error" in body) throw new Error((body as { error: string }).error ?? "failed");
      setTaxOut(body as Tax);
    } catch (e) {
      setTaxErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runStock() {
    setBusy(true);
    setStockErr("");
    setStock(null);
    try {
      const res = await fetch(`${GATEWAY}/api/tools/stock?symbol=${encodeURIComponent(symbol.trim())}`, { credentials: "include" });
      const body = (await res.json()) as Stock;
      if (!res.ok || body.error) throw new Error(body.error ?? `failed ${res.status}`);
      setStock(body);
    } catch (e) {
      setStockErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px] text-foreground";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Money Tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">Calculators for retirement, tax and market lookups.</p>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ${
              tab === t.id
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/50 bg-background/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "retirement" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <Calculator className="h-4 w-4 text-primary" /> Retirement plan
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-age" className="text-[12px]">Current age</Label>
                  <Input id="r-age" type="number" className={inputCls} value={ret.current_age} onChange={(e) => setRet({ ...ret, current_age: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-retire" className="text-[12px]">Retire at</Label>
                  <Input id="r-retire" type="number" className={inputCls} value={ret.retire_age} onChange={(e) => setRet({ ...ret, retire_age: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-exp" className="text-[12px]">Monthly expense today (₹)</Label>
                  <Input id="r-exp" type="number" className={inputCls} value={ret.monthly_expense} onChange={(e) => setRet({ ...ret, monthly_expense: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-sip" className="text-[12px]">Monthly SIP (₹)</Label>
                  <Input id="r-sip" type="number" className={inputCls} value={ret.monthly_sip} onChange={(e) => setRet({ ...ret, monthly_sip: e.target.value })} />
                </div>
              </div>
              <Button onClick={() => void runRetirement()} disabled={busy}>Calculate</Button>
              {retErr && <p className="text-[12px] text-destructive">{retErr}</p>}
              <p className="text-[11px] text-muted-foreground">Assumes 12% pre-tax equity returns, 6% inflation, 4% safe withdrawal rate.</p>
            </CardContent>
          </Card>
          {retOut && (
            <div className="flex flex-col gap-3">
              <ResultCard title="Projected corpus" value={fmt(retOut.projected_corpus)} />
              <ResultCard
                title="Monthly retirement income"
                value={`${fmt(retOut.monthly_retirement_income)} (${fmt(retOut.monthly_retirement_income_today)} in today's ₹)`}
              />
              <ResultCard
                title="Monthly shortfall vs current expense"
                value={fmt(retOut.monthly_shortfall)}
                note={retOut.monthly_shortfall > 0 ? `Top up SIP to ~${fmt(retOut.required_monthly_sip_for_full_cover)}/month to close it.` : "Covered — no shortfall."}
              />
            </div>
          )}
        </div>
      )}

      {tab === "tax" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <Percent className="h-4 w-4 text-primary" /> Old vs new regime (FY 2026-27)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-income" className="text-[12px]">Annual income (₹)</Label>
                  <Input id="t-income" type="number" className={inputCls} value={tax.annual_income} onChange={(e) => setTax({ ...tax, annual_income: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-80c" className="text-[12px]">80C invested (₹, max 1.5L)</Label>
                  <Input id="t-80c" type="number" className={inputCls} value={tax.s80c} onChange={(e) => setTax({ ...tax, s80c: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-basic" className="text-[12px]">Basic + DA (₹/month)</Label>
                  <Input id="t-basic" type="number" className={inputCls} value={tax.basic_da} onChange={(e) => setTax({ ...tax, basic_da: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-hra" className="text-[12px]">HRA received (₹/month)</Label>
                  <Input id="t-hra" type="number" className={inputCls} value={tax.hra} onChange={(e) => setTax({ ...tax, hra: e.target.value })} />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="t-rent" className="text-[12px]">Rent paid (₹/month)</Label>
                  <Input id="t-rent" type="number" className={inputCls} value={tax.rent_paid} onChange={(e) => setTax({ ...tax, rent_paid: e.target.value })} />
                </div>
              </div>
              <Button onClick={() => void runTax()} disabled={busy}>Compare regimes</Button>
              {taxErr && <p className="text-[12px] text-destructive">{taxErr}</p>}
            </CardContent>
          </Card>
          {taxOut && (
            <div className="flex flex-col gap-3">
              <ResultCard title="New regime tax" value={fmt(taxOut.new_regime_tax)} />
              <ResultCard title="Old regime tax" value={fmt(taxOut.old_regime_tax)} />
              <ResultCard
                title="Better regime"
                value={taxOut.better_regime === "new" ? "New regime" : "Old regime"}
                note={taxOut.saving_if_switch > 0 ? `Save ${fmt(taxOut.saving_if_switch)}/yr by switching.` : "No meaningful difference."}
              />
              {taxOut.s80c_headroom > 0 && (
                <ResultCard title="80C headroom left" value={fmt(taxOut.s80c_headroom)} note="PPF, ELSS or EPF contributions qualify." />
              )}
            </div>
          )}
        </div>
      )}

      {tab === "stock" && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <LineChart className="h-4 w-4 text-primary" /> Stock quote (Twelve Data)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. RELIANCE.NSE, TCS.BSE"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runStock()}
              />
              <Button onClick={() => void runStock()} disabled={busy || !symbol.trim()}>Look up</Button>
            </div>
            {stockErr && <p className="text-[12px] text-destructive">{stockErr}</p>}
            {stock && stock.close && (
              <div className="grid grid-cols-2 gap-3">
                <ResultCard title="Symbol" value={stock.symbol} />
                <ResultCard title="Name" value={stock.name ?? stock.symbol} />
                <ResultCard title="Last close" value={fmt(parseFloat(stock.close))} />
                <ResultCard
                  title="Change"
                  value={`${stock.change ?? "0"} (${stock.percent_change ?? "0"}%)`}
                />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Use symbols like RELIANCE.NSE (NSE) or TCS.BSE (BSE).</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
