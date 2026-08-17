"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { gql } from "@/lib/gql";
import { DATA_CHANGED_EVENT } from "@/lib/use-live-data";

export type IncomeStream = {
  source: string;
  frequency: string;
  amount: number;
  currency: string;
  fromDate: string | null;
};

const PAGE_SIZE = 4;
const FREQUENCIES = ["MONTHLY", "QUARTERLY", "YEARLY", "WEEKLY", "ONCE"];

export function BillsIncomeCard({ streams }: { streams: IncomeStream[] }) {
  const [page, setPage] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pages = Math.max(1, Math.ceil(streams.length / PAGE_SIZE));
  const items = streams.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const canPrev = page > 0;
  const canNext = page < pages - 1;

  const addStream = async () => {
    const amt = Number(amount);
    if (!source.trim()) {
      setError("Enter a source name");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await gql<{ addIncomeStream: unknown }>(
        `mutation($input: IncomeStreamInput!) {
          addIncomeStream(input: $input) { source amount frequency }
        }`,
        { input: { source: source.trim(), amount: amt, frequency } },
      );
      setSource("");
      setAmount("");
      setManageOpen(false);
      window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
    } catch {
      setError("Couldn't save — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <h3 className="text-base font-bold text-foreground">Bills & Income</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={!canPrev}
            className="rounded-full p-1 text-muted-foreground hover:bg-chart-2/20 hover:text-primary transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={!canNext}
            className="rounded-full p-1 text-muted-foreground hover:bg-chart-2/20 hover:text-primary transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.length === 0 && (
          <div className="col-span-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-xs text-muted-foreground">
            No income streams yet — add one below.
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.source + item.frequency + item.amount}
            className="flex flex-col justify-between rounded-xl border border-border bg-muted/50 p-3.5 transition-all duration-300 hover:bg-chart-2/10"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-chart-2/40 text-xs font-bold text-foreground">
                ₹
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground truncate">{item.frequency}</span>
            </div>

            <div className="mt-3">
              <p className="text-xs font-semibold text-foreground truncate">{item.source}</p>
              <p className="text-sm font-black tabular-nums mt-0.5 text-primary">
                +₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setManageOpen(true)}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-chart-2/30 hover:bg-chart-2/50 border border-primary/30 py-2.5 text-xs font-bold text-foreground transition-all"
      >
        <Plus className="h-3.5 w-3.5" />
        Manage income
      </button>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add income stream</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="is-source">Source</Label>
              <Input
                id="is-source"
                placeholder="e.g. Salary, Rent, Freelance"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="is-amount">Amount (₹)</Label>
                <Input
                  id="is-amount"
                  type="number"
                  min="0"
                  placeholder="50000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f.charAt(0) + f.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              onClick={() => void addStream()}
              disabled={saving}
              className="mt-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add stream"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}