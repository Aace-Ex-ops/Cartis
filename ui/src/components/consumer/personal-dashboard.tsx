"use client";

import { useEffect, useState } from "react";
import { Sparkles, SlidersHorizontal } from "lucide-react";
import { AccountsTree } from "@/components/consumer/accounts-tree";
import { NetWorthChart } from "@/components/consumer/net-worth-chart";
import { RecentTransactionsCard } from "@/components/consumer/recent-transactions-card";
import { BillsIncomeCard } from "@/components/consumer/bills-income-card";
import { IncomeSpendingSummary } from "@/components/consumer/income-spending-summary";
import { getMe, type User } from "@/lib/auth";

export function PersonalDashboard() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    void getMe().then((u) => {
      if (u) setUser(u);
    });
  }, []);

  const firstName = user?.name ? user.name.split(" ")[0] : "Sam";
  const totalNetWorth = 97567.55;

  return (
    <div className="relative flex flex-col gap-6 text-[#132a13] pb-12">
      {/* Top Greeting Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[#132a13] md:text-3xl">
          Hello, {firstName}! 👋
        </h1>

        <button className="flex items-center gap-2 rounded-xl border border-[#7ec151]/30 bg-white px-4 py-2 text-xs font-bold text-[#132a13] hover:bg-[#b2d959]/15 transition-all shadow-sm">
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#7ec151]" />
          <span>Customize</span>
        </button>
      </div>

      {/* Main Mobbin 2-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Accounts Tree Panel */}
        <div className="lg:col-span-1">
          <AccountsTree totalNetWorth={totalNetWorth} />
        </div>

        {/* Right Column: Net Worth, Transactions, Bills, Income & Spending */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Net Worth Chart Card */}
          <NetWorthChart totalNetWorth={totalNetWorth} />

          {/* Transactions & Bills Row */}
          <div className="grid gap-6 sm:grid-cols-2">
            <RecentTransactionsCard />
            <BillsIncomeCard />
          </div>

          {/* Income & Spending Summary Row */}
          <IncomeSpendingSummary />
        </div>
      </div>

      {/* Floating Action AI Button (Color Hunt Meadow Green #7EC151 / Yellow #FED24F) */}
      <button
        className="fixed bottom-8 right-8 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-tr from-[#7ec151] via-[#b2d959] to-[#fed24f] text-white shadow-[0_0_20px_rgba(126,193,81,0.5)] transition-transform duration-300 hover:scale-110 active:scale-95"
        title="Cartis AI Advisor"
      >
        <Sparkles className="h-6 w-6 text-white" />
      </button>
    </div>
  );
}