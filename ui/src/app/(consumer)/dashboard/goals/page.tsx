"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gql } from "@/lib/gql";
import { SkeletonHeading } from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

type Goal = {
  goalId: string;
  goalType: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progressPct: number;
  targetDate: string | null;
};

const TYPES: [string, string][] = [
  ["emergency", "Emergency fund"],
  ["retirement", "Retirement"],
  ["home", "Home"],
  ["education", "Education"],
  ["other", "Other"],
];

const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("emergency");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");

  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const d = await gql<{ financialGoals: Goal[] }>(`query { financialGoals { goalId goalType name targetAmount currentAmount progressPct targetDate } }`);
      setGoals(d.financialGoals);
      setLoading(false);
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

  async function addGoal() {
    const targetAmount = parseFloat(target);
    if (!name.trim() || !targetAmount || targetAmount <= 0) return;
    await gql(
      `mutation($goalType: String!, $name: String!, $targetAmount: Float!, $currentAmount: Float) {
        addFinancialGoal(goalType: $goalType, name: $name, targetAmount: $targetAmount, currentAmount: $currentAmount) { goalId }
      }`,
      { goalType: type, name: name.trim(), targetAmount, currentAmount: parseFloat(current) || undefined },
    );
    setName("");
    setTarget("");
    setCurrent("");
    setOpen(false);
    void load();
  }

  async function bump(goal: Goal, amount: number) {
    await gql(
      `mutation($goalId: String!, $currentAmount: Float!) { updateFinancialGoal(goalId: $goalId, currentAmount: $currentAmount) { goalId } }`,
      { goalId: goal.goalId, currentAmount: Math.max(0, goal.currentAmount + amount) },
    );
    void load();
  }

  async function remove(goal: Goal) {
    await gql(`mutation($goalId: String!) { deleteFinancialGoal(goalId: $goalId) }`, { goalId: goal.goalId });
    void load();
  }

  if (failed) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Couldn&apos;t load your goals — refresh to try again.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <SkeletonHeading />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-7 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Financial Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track targets like an emergency fund or retirement corpus.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(!open)}>
          <Plus className="mr-2 h-4 w-4" /> Add goal
        </Button>
      </div>

      {open && (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-type" className="text-[12px]">Type</Label>
              <select
                id="goal-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px] text-foreground"
              >
                {TYPES.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-name" className="text-[12px]">Name</Label>
              <Input id="goal-name" placeholder="e.g. 6-month safety net" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-target" className="text-[12px]">Target amount (₹)</Label>
              <Input id="goal-target" type="number" placeholder="300000" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-current" className="text-[12px]">Already saved (₹)</Label>
              <Input id="goal-current" type="number" placeholder="0" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <Button className="sm:col-span-2" onClick={() => void addGoal()} disabled={!name.trim() || !(parseFloat(target) > 0)}>
              Create goal
            </Button>
          </CardContent>
        </Card>
      )}

      {goals.length === 0 && (
        <p className="rounded-xl border border-border/50 bg-background/60 px-4 py-3 text-[13px] text-muted-foreground">
          No goals yet — add an emergency fund (6× monthly spend) or a retirement target to start tracking.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((g) => (
          <Card key={g.goalId}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-[14px]">
                <span className="truncate">{g.name}</span>
                <span className="shrink-0 rounded-full border border-border/50 px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                  {TYPES.find(([v]) => v === g.goalType)?.[1] ?? g.goalType}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="text-muted-foreground">{fmt(g.currentAmount)} of {fmt(g.targetAmount)}</span>
                  <span className="font-medium text-foreground">{Math.round(g.progressPct)}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-elevated">
                  <div
                    className={`h-full rounded-full ${g.progressPct >= 100 ? "bg-emerald-500" : "bg-primary"}`}
                    style={{ width: `${Math.min(100, g.progressPct)}%` }}
                  />
                </div>
              </div>
              {g.targetDate && (
                <p className="text-[11px] text-muted-foreground">Target: {new Date(g.targetDate).toLocaleDateString()}</p>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void bump(g, 1000)}>+ ₹1,000</Button>
                <Button variant="outline" size="sm" onClick={() => void bump(g, 10000)}>+ ₹10,000</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => void remove(g)}
                  aria-label={`Delete ${g.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <TrendingUp className="h-4 w-4" />
        Tip: keep your emergency fund at 6 months of expenses before investing elsewhere.
      </p>
    </div>
  );
}
