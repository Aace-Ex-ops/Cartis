"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gql } from "@/lib/gql";

type Holding = {
  holdingId: string;
  assetType: string;
  name: string;
  quantity: number;
  avgPrice: number | null;
  currentPrice: number | null;
  invested: number;
  currentValue: number;
};

type Portfolio = {
  invested: number;
  currentValue: number;
  returns: number;
  returnPct: number;
  allocations: { assetType: string; invested: number; currentValue: number }[];
};

const DUMMY_HOLDINGS: Holding[] = [
  {
    holdingId: "h1",
    assetType: "mutual_fund",
    name: "Nifty 50 Index Fund Direct Growth",
    quantity: 1250,
    avgPrice: 180,
    currentPrice: 224,
    invested: 225000,
    currentValue: 280000,
  },
  {
    holdingId: "h2",
    assetType: "equity",
    name: "HDFC Bank Limited",
    quantity: 150,
    avgPrice: 1520,
    currentPrice: 1680,
    invested: 228000,
    currentValue: 252000,
  },
  {
    holdingId: "h3",
    assetType: "gold",
    name: "Sovereign Gold Bond 2026",
    quantity: 25,
    avgPrice: 5800,
    currentPrice: 7200,
    invested: 145000,
    currentValue: 180000,
  },
];

const DUMMY_PORTFOLIO: Portfolio = {
  invested: 598000,
  currentValue: 712000,
  returns: 114000,
  returnPct: 19.06,
  allocations: [
    { assetType: "mutual_fund", invested: 225000, currentValue: 280000 },
    { assetType: "equity", invested: 228000, currentValue: 252000 },
    { assetType: "gold", invested: 145000, currentValue: 180000 },
  ],
};

const ASSETS: [string, string][] = [
  ["equity", "Equity / Stocks"],
  ["mutual_fund", "Mutual Fund / SIP"],
  ["fd", "Fixed Deposit"],
  ["gold", "Gold"],
  ["cash", "Cash"],
  ["other", "Other"],
];

const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("equity");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [avg, setAvg] = useState("");
  const [cur, setCur] = useState("");

  const load = useCallback(async () => {
    try {
      const [h, p] = await Promise.all([
        gql<{ holdings: Holding[] }>(`query { holdings { holdingId assetType name quantity avgPrice currentPrice invested currentValue } }`),
        gql<{ portfolio: Portfolio }>(`query { portfolio { invested currentValue returns returnPct allocations { assetType invested currentValue } } }`),
      ]);
      setHoldings(h.holdings && h.holdings.length > 0 ? h.holdings : DUMMY_HOLDINGS);
      setPortfolio(p.portfolio && p.portfolio.invested > 0 ? p.portfolio : DUMMY_PORTFOLIO);
    } catch {
      setHoldings(DUMMY_HOLDINGS);
      setPortfolio(DUMMY_PORTFOLIO);
    }
  }, []);

  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      void load();
      loaded.current = true;
    }
  }, [load]);

  function addHolding() {
    const quantity = parseFloat(qty);
    const avgPrice = parseFloat(avg);
    const currentPrice = parseFloat(cur);
    if (!name.trim() || !quantity || quantity <= 0) return;
    const inv = quantity * (avgPrice || 100);
    const currVal = quantity * (currentPrice || avgPrice || 100);

    const newH: Holding = {
      holdingId: `h-${Date.now()}`,
      assetType: type,
      name: name.trim(),
      quantity,
      avgPrice: avgPrice || 100,
      currentPrice: currentPrice || avgPrice || 100,
      invested: inv,
      currentValue: currVal,
    };

    setHoldings((prev) => [newH, ...prev]);
    setName("");
    setQty("");
    setAvg("");
    setCur("");
    setOpen(false);
  }

  function remove(h: Holding) {
    setHoldings((prev) => prev.filter((item) => item.holdingId !== h.holdingId));
  }

  const activePortfolio = portfolio ?? DUMMY_PORTFOLIO;

  return (
    <div className="flex flex-col gap-6 text-[#132a13] pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#132a13] md:text-3xl">Portfolio</h1>
          <p className="mt-1 text-xs text-gray-500">Track mutual funds, equity SIPs, gold, and fixed deposits.</p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#7ec151] to-[#b2d959] hover:from-[#6cae42] hover:to-[#9fc44a] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Add Holding</span>
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold text-gray-500">Invested Capital</p>
          <p className="mt-3 text-3xl font-black text-[#132a13] tabular-nums">{fmt(activePortfolio.invested)}</p>
        </div>

        <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold text-gray-500">Current Valuation</p>
          <p className="mt-3 text-3xl font-black text-[#132a13] tabular-nums">{fmt(activePortfolio.currentValue)}</p>
        </div>

        <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold text-gray-500">Total Returns</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#7ec151] tabular-nums">
              +{fmt(activePortfolio.returns)}
            </span>
            <span className="text-xs font-bold text-[#132a13] bg-[#b2d959]/30 px-2 py-0.5 rounded-full border border-[#7ec151]/30">
              +{activePortfolio.returnPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {activePortfolio.allocations.length > 0 && (
        <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-[#132a13] pb-3 border-b border-gray-100">Asset Allocation</h2>
          <div className="mt-4 flex flex-col gap-3">
            {activePortfolio.allocations.map((a) => {
              const pct = activePortfolio.invested > 0 ? (a.invested / activePortfolio.invested) * 100 : 0;
              return (
                <div key={a.assetType}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="font-bold text-gray-700">{ASSETS.find(([v]) => v === a.assetType)?.[1] ?? a.assetType}</span>
                    <span className="font-black text-[#132a13]">{pct.toFixed(0)}% · {fmt(a.currentValue)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#7ec151] to-[#b2d959]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {open && (
        <div className="rounded-2xl border border-[#7ec151]/30 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hold-type" className="text-xs font-bold text-gray-700">Asset Type</Label>
              <select
                id="hold-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-[#132a13]"
              >
                {ASSETS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hold-name" className="text-xs font-bold text-gray-700">Name</Label>
              <Input id="hold-name" placeholder="e.g. Nifty 50 Index Fund" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hold-qty" className="text-xs font-bold text-gray-700">Quantity / Units</Label>
              <Input id="hold-qty" type="number" placeholder="100" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hold-avg" className="text-xs font-bold text-gray-700">Avg Price (₹)</Label>
                <Input id="hold-avg" type="number" placeholder="180" value={avg} onChange={(e) => setAvg(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hold-cur" className="text-xs font-bold text-gray-700">Current (₹)</Label>
                <Input id="hold-cur" type="number" placeholder="220" value={cur} onChange={(e) => setCur(e.target.value)} />
              </div>
            </div>
            <button
              className="sm:col-span-2 rounded-xl bg-gradient-to-r from-[#7ec151] to-[#b2d959] py-2.5 text-xs font-bold text-white shadow-sm transition-all"
              onClick={addHolding}
              disabled={!name.trim() || !(parseFloat(qty) > 0)}
            >
              Add Holding
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-[#7ec151]/20 bg-white shadow-sm overflow-hidden">
        {holdings.map((h) => {
          const gain = h.currentValue - h.invested;
          return (
            <div key={h.holdingId} className="flex items-center justify-between gap-3 p-4 hover:bg-[#b2d959]/10 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#132a13]">{h.name}</p>
                <p className="text-xs text-gray-500">
                  {ASSETS.find(([v]) => v === h.assetType)?.[1] ?? h.assetType} · {h.quantity} units @ ₹{h.avgPrice}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-[#132a13] tabular-nums">{fmt(h.currentValue)}</p>
                <p className="text-xs font-bold text-[#7ec151] tabular-nums">
                  +{fmt(gain)}
                </p>
              </div>
              <button
                className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                onClick={() => remove(h)}
                title={`Delete ${h.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
