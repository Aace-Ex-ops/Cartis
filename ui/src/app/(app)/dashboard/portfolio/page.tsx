"use client";

 import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gql } from "@/lib/gql";
import { SkeletonHeading, SkeletonCard, SkeletonRow } from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

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

const ASSETS: [string, string][] = [
  ["equity", "Equity / Stocks"],
  ["mutual_fund", "Mutual fund / SIP"],
  ["fd", "Fixed deposit"],
  ["gold", "Gold"],
  ["cash", "Cash"],
  ["other", "Other"],
];

const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [failed, setFailed] = useState(false);
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
    setHoldings(h.holdings);
    setPortfolio(p.portfolio);
  } catch {
    setFailed(true);
  }
}, []);

const loaded = useRef(false);

useEffect(() => {
  if (!loaded.current) {
    load();
    loaded.current = true;
  }
}, [load]);

// Open/close actions
async function addHolding() {
    const quantity = parseFloat(qty);
    const avgPrice = parseFloat(avg);
    const currentPrice = parseFloat(cur);
    if (!name.trim() || !quantity || quantity <= 0) return;
    await gql(
      `mutation($assetType: String!, $name: String!, $quantity: Float!, $avgPrice: Float, $currentPrice: Float) {
        addHolding(assetType: $assetType, name: $name, quantity: $quantity, avgPrice: $avgPrice, currentPrice: $currentPrice) { holdingId }
      }`,
      {
        assetType: type,
        name: name.trim(),
        quantity,
        avgPrice: avgPrice || undefined,
        currentPrice: currentPrice || undefined,
      },
    );
    setName("");
    setQty("");
    setAvg("");
    setCur("");
    setOpen(false);
    void load();
  }

  async function updatePrice(h: Holding) {
    const next = window.prompt(`Current price of ${h.name} (₹)`, String(h.currentPrice ?? h.avgPrice ?? ""));
    const price = parseFloat(next ?? "");
    if (!price || price <= 0) return;
    await gql(
      `mutation($holdingId: String!, $currentPrice: Float!) { updateHolding(holdingId: $holdingId, currentPrice: $currentPrice) { holdingId } }`,
      { holdingId: h.holdingId, currentPrice: price },
    );
    void load();
  }

  async function remove(h: Holding) {
    await gql(`mutation($holdingId: String!) { deleteHolding(holdingId: $holdingId) }`, { holdingId: h.holdingId });
    void load();
  }

  if (failed) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Couldn&apos;t load your portfolio — refresh to try again.
      </p>
    );
  }

  if (portfolio === null) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <SkeletonHeading />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} withBadge={false} />)}
        </div>
      </div>
    );
  }

  const up = (portfolio?.returns ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Portfolio</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manual holdings — update prices to track returns.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(!open)}>
          <Plus className="mr-2 h-4 w-4" /> Add holding
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] text-muted-foreground">Invested</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-foreground">{fmt(portfolio?.invested ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] text-muted-foreground">Current value</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-foreground">{fmt(portfolio?.currentValue ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] text-muted-foreground">Returns</CardTitle>
          </CardHeader>
          <CardContent className={`text-xl font-semibold ${up ? "text-emerald-600" : "text-red-600"}`}>
            {up ? "+" : ""}{fmt(portfolio?.returns ?? 0)}
            <span className="ml-1 text-sm">({up ? "+" : ""}{portfolio?.returnPct.toFixed(1) ?? "0.0"}%)</span>
          </CardContent>
        </Card>
      </div>

      {portfolio && portfolio.allocations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px]">Allocation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {portfolio.allocations.map((a) => {
              const pct = portfolio.invested > 0 ? (a.invested / portfolio.invested) * 100 : 0;
              return (
                <div key={a.assetType}>
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span className="text-muted-foreground">{ASSETS.find(([v]) => v === a.assetType)?.[1] ?? a.assetType}</span>
                    <span className="font-medium text-foreground">{pct.toFixed(0)}% · {fmt(a.currentValue)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-elevated">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {open && (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hold-type" className="text-[12px]">Asset type</Label>
              <select
                id="hold-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px] text-foreground"
              >
                {ASSETS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hold-name" className="text-[12px]">Name</Label>
              <Input id="hold-name" placeholder="e.g. Nifty 50 Index Fund" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hold-qty" className="text-[12px]">Quantity / units</Label>
              <Input id="hold-qty" type="number" placeholder="100" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hold-avg" className="text-[12px]">Avg price (₹)</Label>
                <Input id="hold-avg" type="number" placeholder="100.5" value={avg} onChange={(e) => setAvg(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hold-cur" className="text-[12px]">Current (₹)</Label>
                <Input id="hold-cur" type="number" placeholder="120" value={cur} onChange={(e) => setCur(e.target.value)} />
              </div>
            </div>
            <Button className="sm:col-span-2" onClick={() => void addHolding()} disabled={!name.trim() || !(parseFloat(qty) > 0)}>
              Add holding
            </Button>
          </CardContent>
        </Card>
      )}

      {holdings.length === 0 ? (
        <p className="rounded-xl border border-border/50 bg-background/60 px-4 py-3 text-[13px] text-muted-foreground">
          No holdings yet — add your first SIP, FD or stock to see your portfolio.
        </p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {holdings.map((h) => {
                const gain = h.currentValue - h.invested;
                return (
                  <div key={h.holdingId} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">{h.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ASSETS.find(([v]) => v === h.assetType)?.[1] ?? h.assetType} · {h.quantity} units
                        {h.avgPrice ? ` @ ₹${h.avgPrice}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-medium text-foreground">{fmt(h.currentValue)}</p>
                      <p className={`text-[11px] ${gain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {gain >= 0 ? "+" : ""}{fmt(gain)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void updatePrice(h)} title="Update current price">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void remove(h)}
                      aria-label={`Delete ${h.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
