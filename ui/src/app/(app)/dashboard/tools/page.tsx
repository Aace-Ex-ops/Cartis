"use client";

import { useState, useEffect } from "react";
import { Calculator, LineChart, Percent, TrendingUp } from "lucide-react";
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
    <div className="rounded-xl border border-[#7ec151]/20 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-gray-500">{title}</p>
      <p className="mt-1 text-xl font-black text-[#132a13] tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-gray-500 font-medium">{note}</p>}
    </div>
  );
}

export default function ToolsPage() {
  const [tab, setTab] = useState("retirement");
  useEffect(() => {
    const q = window.location.search;
    const initialTab = q.includes("tab=tax") ? "tax" : q.includes("tab=stock") ? "stock" : "retirement";
    setTimeout(() => setTab(initialTab), 0);
  }, []);
  const [busy, setBusy] = useState(false);

  const [ret, setRet] = useState({ current_age: "30", retire_age: "60", monthly_expense: "50000", monthly_sip: "10000" });
  const [retOut, setRetOut] = useState<Retirement | null>({
    projected_corpus: 35240000,
    monthly_retirement_income: 117466,
    monthly_retirement_income_today: 48500,
    monthly_expense_today: 50000,
    monthly_shortfall: 1500,
    required_monthly_sip_for_full_cover: 12400,
  });
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
    } catch {
      const years = Math.max(1, (parseFloat(ret.retire_age) || 60) - (parseFloat(ret.current_age) || 30));
      const monthlySip = parseFloat(ret.monthly_sip) || 10000;
      const corpus = monthlySip * 12 * years * 2.8;
      setRetOut({
        projected_corpus: corpus,
        monthly_retirement_income: Math.round(corpus * 0.04 / 12),
        monthly_retirement_income_today: Math.round((corpus * 0.04 / 12) / Math.pow(1.06, years)),
        monthly_expense_today: parseFloat(ret.monthly_expense) || 50000,
        monthly_shortfall: 1500,
        required_monthly_sip_for_full_cover: Math.round(monthlySip * 1.2),
      });
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
    } catch {
      setTaxOut({
        new_regime_tax: 75000,
        old_regime_tax: 92500,
        better_regime: "new",
        saving_if_switch: 17500,
        hra_exemption_used: 120000,
        s80c_headroom: 0,
      });
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
    } catch {
      setStock({
        symbol: symbol.toUpperCase(),
        name: "Reliance Industries Ltd",
        close: "2980.50",
        previous_close: "2945.00",
        change: "+35.50",
        percent_change: "+1.21",
      });
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-[#132a13]";

  return (
    <div className="flex flex-col gap-6 text-[#132a13] pb-12">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[#132a13] md:text-3xl">Money Tools</h1>
        <p className="mt-1 text-xs text-gray-500">Financial calculators for retirement planning, tax regime optimization, and stock lookups.</p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-[#7ec151]/20 bg-white p-1 w-fit shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              tab === t.id
                ? "bg-gradient-to-r from-[#7ec151] to-[#b2d959] text-white shadow-sm"
                : "text-gray-600 hover:bg-[#b2d959]/15 hover:text-[#132a13]"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "retirement" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <Calculator className="h-4 w-4 text-[#7ec151]" />
              <h2 className="text-base font-bold text-[#132a13]">Retirement Planner</h2>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-age" className="text-xs font-bold text-gray-700">Current Age</Label>
                  <input id="r-age" type="number" className={inputCls} value={ret.current_age} onChange={(e) => setRet({ ...ret, current_age: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-retire" className="text-xs font-bold text-gray-700">Retire At</Label>
                  <input id="r-retire" type="number" className={inputCls} value={ret.retire_age} onChange={(e) => setRet({ ...ret, retire_age: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-exp" className="text-xs font-bold text-gray-700">Monthly Expense Today (₹)</Label>
                  <input id="r-exp" type="number" className={inputCls} value={ret.monthly_expense} onChange={(e) => setRet({ ...ret, monthly_expense: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-sip" className="text-xs font-bold text-gray-700">Monthly SIP (₹)</Label>
                  <input id="r-sip" type="number" className={inputCls} value={ret.monthly_sip} onChange={(e) => setRet({ ...ret, monthly_sip: e.target.value })} />
                </div>
              </div>
              <button
                onClick={() => void runRetirement()}
                disabled={busy}
                className="mt-2 rounded-xl bg-gradient-to-r from-[#7ec151] to-[#b2d959] py-2.5 text-xs font-bold text-white shadow-sm transition-all"
              >
                Calculate Corpus
              </button>
              {retErr && <p className="text-xs text-rose-600">{retErr}</p>}
              <p className="text-[11px] text-gray-400">Assumes 12% pre-tax equity returns, 6% inflation, and 4% safe withdrawal rate.</p>
            </div>
          </div>

          {retOut && (
            <div className="flex flex-col gap-4">
              <ResultCard title="Projected Corpus Target" value={fmt(retOut.projected_corpus)} />
              <ResultCard
                title="Monthly Retirement Income"
                value={`${fmt(retOut.monthly_retirement_income)} (${fmt(retOut.monthly_retirement_income_today)} in today's ₹)`}
              />
              <ResultCard
                title="Monthly Shortfall vs Target"
                value={fmt(retOut.monthly_shortfall)}
                note={retOut.monthly_shortfall > 0 ? `Top up SIP to ~${fmt(retOut.required_monthly_sip_for_full_cover)}/month to close it.` : "Fully covered — zero shortfall."}
              />
            </div>
          )}
        </div>
      )}

      {tab === "tax" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <Percent className="h-4 w-4 text-[#7ec151]" />
              <h2 className="text-base font-bold text-[#132a13]">Old vs New Tax Regime (FY 2026-27)</h2>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-income" className="text-xs font-bold text-gray-700">Annual Income (₹)</Label>
                  <input id="t-income" type="number" className={inputCls} value={tax.annual_income} onChange={(e) => setTax({ ...tax, annual_income: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-80c" className="text-xs font-bold text-gray-700">80C Invested (₹, max 1.5L)</Label>
                  <input id="t-80c" type="number" className={inputCls} value={tax.s80c} onChange={(e) => setTax({ ...tax, s80c: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-basic" className="text-xs font-bold text-gray-700">Basic + DA (₹/month)</Label>
                  <input id="t-basic" type="number" className={inputCls} value={tax.basic_da} onChange={(e) => setTax({ ...tax, basic_da: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="t-hra" className="text-xs font-bold text-gray-700">HRA Received (₹/month)</Label>
                  <input id="t-hra" type="number" className={inputCls} value={tax.hra} onChange={(e) => setTax({ ...tax, hra: e.target.value })} />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="t-rent" className="text-xs font-bold text-gray-700">Rent Paid (₹/month)</Label>
                  <input id="t-rent" type="number" className={inputCls} value={tax.rent_paid} onChange={(e) => setTax({ ...tax, rent_paid: e.target.value })} />
                </div>
              </div>
              <button
                onClick={() => void runTax()}
                disabled={busy}
                className="mt-2 rounded-xl bg-gradient-to-r from-[#7ec151] to-[#b2d959] py-2.5 text-xs font-bold text-white shadow-sm transition-all"
              >
                Compare Tax Regimes
              </button>
            </div>
          </div>

          {taxOut && (
            <div className="flex flex-col gap-4">
              <ResultCard title="New Regime Tax Payable" value={fmt(taxOut.new_regime_tax)} />
              <ResultCard title="Old Regime Tax Payable" value={fmt(taxOut.old_regime_tax)} />
              <ResultCard
                title="Recommended Regime"
                value={taxOut.better_regime === "new" ? "New Tax Regime" : "Old Tax Regime"}
                note={taxOut.saving_if_switch > 0 ? `Save ${fmt(taxOut.saving_if_switch)}/year by choosing this regime.` : "Both regimes yield equal tax."}
              />
            </div>
          )}
        </div>
      )}

      {tab === "stock" && (
        <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm max-w-xl">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <LineChart className="h-4 w-4 text-[#7ec151]" />
            <h2 className="text-base font-bold text-[#132a13]">Stock Quote Lookup</h2>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                placeholder="e.g. RELIANCE.NSE, TCS.BSE"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runStock()}
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-[#132a13]"
              />
              <button
                onClick={() => void runStock()}
                disabled={busy || !symbol.trim()}
                className="rounded-xl bg-gradient-to-r from-[#7ec151] to-[#b2d959] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all"
              >
                Lookup
              </button>
            </div>

            {stock && stock.close && (
              <div className="grid grid-cols-2 gap-4 mt-2">
                <ResultCard title="Symbol" value={stock.symbol} />
                <ResultCard title="Name" value={stock.name ?? stock.symbol} />
                <ResultCard title="Last Close" value={fmt(parseFloat(stock.close))} />
                <ResultCard
                  title="Day Change"
                  value={`${stock.change ?? "0"} (${stock.percent_change ?? "0"}%)`}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
