"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gql } from "@/lib/gql";
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES } from "@/lib/seller";

const CATEGORIES: Record<string, string[]> = {
  revenue: REVENUE_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
};

export function EntryForm({
  entryType,
  onAdded,
}: {
  entryType: "revenue" | "expense";
  onAdded: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[entryType][0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const canSave = Number.isFinite(Number(amount)) && Number(amount) > 0;

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await gql<{ addFinanceEntry: unknown }>(
        `mutation { addFinanceEntry(input: { entryType: "${entryType}", amount: ${Number(amount)}, category: "${category}", description: "${description || category}", transactionDate: "${date}" }) { entryId } }`,
      );
      setAmount("");
      setDescription("");
      onAdded();
    } catch {
      // ignore
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`ef-amount-${entryType}`} className="text-xs text-muted-foreground">
            Amount (₹)
          </Label>
          <Input
            id={`ef-amount-${entryType}`}
            type="number"
            placeholder="e.g. 12000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`ef-cat-${entryType}`} className="text-xs text-muted-foreground">
            Category
          </Label>
          <select
            id={`ef-cat-${entryType}`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border border-border/50 bg-background/50 px-3 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {CATEGORIES[entryType].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`ef-desc-${entryType}`} className="text-xs text-muted-foreground">
            Note
          </Label>
          <Input
            id={`ef-desc-${entryType}`}
            placeholder="e.g. fabric order #42"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`ef-date-${entryType}`} className="text-xs text-muted-foreground">
            Date
          </Label>
          <Input
            id={`ef-date-${entryType}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Button onClick={() => void save()} disabled={!canSave || saving} size="sm">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
