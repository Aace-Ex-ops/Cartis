"use client";

import { useCallback, useState } from "react";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gql } from "@/lib/gql";
import { useLiveData } from "@/lib/use-live-data";
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

const DUMMY_GOALS: Goal[] = [
  {
    goalId: "g1",
    goalType: "emergency",
    name: "6-Month Emergency Safety Net",
    targetAmount: 450000,
    currentAmount: 315000,
    progressPct: 70,
    targetDate: "2026-12-31",
  },
  {
    goalId: "g2",
    goalType: "home",
    name: "New Apartment Down Payment",
    targetAmount: 1500000,
    currentAmount: 645000,
    progressPct: 43,
    targetDate: "2027-06-30",
  },
  {
    goalId: "g3",
    goalType: "retirement",
    name: "NPS & Index Fund Wealth Corpus",
    targetAmount: 5000000,
    currentAmount: 2250000,
    progressPct: 45,
    targetDate: "2035-03-31",
  },
];

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
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("emergency");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await gql<{ financialGoals: Goal[] }>(`query { financialGoals { goalId goalType name targetAmount currentAmount progressPct targetDate } }`);
      setGoals(d.financialGoals && d.financialGoals.length > 0 ? d.financialGoals : DUMMY_GOALS);
      setLoading(false);
    } catch {
      setGoals(DUMMY_GOALS);
      setLoading(false);
    }
  }, []);

  useLiveData(load, [load]);

  async function addGoal() {
    const targetAmount = parseFloat(target);
    if (!name.trim() || !targetAmount || targetAmount <= 0) return;
    const currentVal = parseFloat(current) || 0;
    const newGoal: Goal = {
      goalId: `g-${Date.now()}`,
      goalType: type,
      name: name.trim(),
      targetAmount,
      currentAmount: currentVal,
      progressPct: Math.round((currentVal / targetAmount) * 100),
      targetDate: "2027-12-31",
    };
    setGoals((prev) => [newGoal, ...prev]);
    setName("");
    setTarget("");
    setCurrent("");
    setOpen(false);
  }

  function bump(goal: Goal, amount: number) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.goalId !== goal.goalId) return g;
        const newCurrent = Math.max(0, g.currentAmount + amount);
        return {
          ...g,
          currentAmount: newCurrent,
          progressPct: Math.round((newCurrent / g.targetAmount) * 100),
        };
      })
    );
  }

  function remove(goal: Goal) {
    setGoals((prev) => prev.filter((g) => g.goalId !== goal.goalId));
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
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-[#132a13] pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#132a13] md:text-3xl">Financial Goals</h1>
          <p className="mt-1 text-xs text-gray-500">Track targets like an emergency fund, home down payment, or retirement corpus.</p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#7ec151] to-[#b2d959] hover:from-[#6cae42] hover:to-[#9fc44a] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Add Goal</span>
        </button>
      </div>

      {open && (
        <div className="rounded-2xl border border-[#7ec151]/30 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-type" className="text-xs font-bold text-gray-700">Goal Type</Label>
              <select
                id="goal-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-[#132a13]"
              >
                {TYPES.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-name" className="text-xs font-bold text-gray-700">Goal Name</Label>
              <Input id="goal-name" placeholder="e.g. 6-month safety net" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-target" className="text-xs font-bold text-gray-700">Target Amount (₹)</Label>
              <Input id="goal-target" type="number" placeholder="450000" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-current" className="text-xs font-bold text-gray-700">Already Saved (₹)</Label>
              <Input id="goal-current" type="number" placeholder="100000" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <button
              className="sm:col-span-2 rounded-xl bg-gradient-to-r from-[#7ec151] to-[#b2d959] py-2.5 text-xs font-bold text-white shadow-sm transition-all"
              onClick={() => void addGoal()}
              disabled={!name.trim() || !(parseFloat(target) > 0)}
            >
              Create Goal
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((g) => (
          <div key={g.goalId} className="group relative overflow-hidden rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm transition-all duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="truncate text-sm font-bold text-[#132a13]">{g.name}</span>
              <span className="shrink-0 rounded-full bg-[#fed24f]/40 border border-[#fed24f] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#854d0e]">
                {TYPES.find(([v]) => v === g.goalType)?.[1] ?? g.goalType}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-gray-500 font-semibold">{fmt(g.currentAmount)} of {fmt(g.targetAmount)}</span>
                  <span className="font-black text-[#132a13]">{Math.round(g.progressPct)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7ec151] to-[#b2d959]"
                    style={{ width: `${Math.min(100, g.progressPct)}%` }}
                  />
                </div>
              </div>

              {g.targetDate && (
                <p className="text-[11px] text-gray-400 font-medium">Target Date: {new Date(g.targetDate).toLocaleDateString("en-IN")}</p>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => bump(g, 1000)}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-[#b2d959]/20 transition-all"
                >
                  + ₹1,000
                </button>
                <button
                  onClick={() => bump(g, 10000)}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-[#b2d959]/20 transition-all"
                >
                  + ₹10,000
                </button>
                <button
                  className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  onClick={() => remove(g)}
                  title={`Delete ${g.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-[#7ec151]/20 bg-white p-4 text-xs font-semibold text-gray-600 shadow-sm">
        <TrendingUp className="h-4 w-4 text-[#7ec151]" />
        <span>Tip: Maintain your emergency fund at 6 months of expenses before expanding investment allocations.</span>
      </div>
    </div>
  );
}
