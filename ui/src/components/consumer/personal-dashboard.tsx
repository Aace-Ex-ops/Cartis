"use client";

import { useEffect, useState } from "react";
import { Sparkles, SlidersHorizontal } from "lucide-react";
import { AccountsTree, type BankAccount, type Holding } from "@/components/consumer/accounts-tree";
import { NetWorthChart } from "@/components/consumer/net-worth-chart";
import { RecentTransactionsCard, type LedgerTx } from "@/components/consumer/recent-transactions-card";
import { BillsIncomeCard, type IncomeStream } from "@/components/consumer/bills-income-card";
import { IncomeSpendingSummary, type SpendingDay } from "@/components/consumer/income-spending-summary";
import { getMe, type User } from "@/lib/auth";
import { gql } from "@/lib/gql";

type HomeData = {
  bankAccounts: BankAccount[];
  holdings: Holding[];
  ledgerTransactions: LedgerTx[];
  incomeStreams: IncomeStream[];
  spending30d: SpendingDay[];
  me: { monthlyIncome: number | null; monthlySpend: number | null } | null;
};

const QUERY = `{
  bankAccounts { accountId bankName balance }
  holdings { holdingId assetType name quantity currentPrice }
  ledgerTransactions(limit: 5) { txnType amount description transactionDate }
  incomeStreams { source frequency amount currency fromDate }
  spending30d { day spend }
  me { monthlyIncome monthlySpend }
}`;

export function PersonalDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<HomeData | null>(null);

  useEffect(() => {
    void getMe().then((u) => {
      if (u) setUser(u);
    });
    void gql<HomeData>(QUERY)
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const firstName = user?.name ? user.name.split(" ")[0] : "Sam";
  const bankBalance = (data?.bankAccounts ?? []).reduce((s, a) => s + (a.balance ?? 0), 0);
  const holdingsValue = (data?.holdings ?? []).reduce((s, h) => s + (h.quantity ?? 0) * (h.currentPrice ?? 0), 0);
  const totalNetWorth = bankBalance + holdingsValue;

  return (
    <div className="relative flex flex-col gap-6 text-foreground pb-12">
      {/* Top Greeting Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Hello, {firstName}! 👋
        </h1>

        <button className="flex items-center gap-2 rounded-xl border border-primary/30 bg-background px-4 py-2 text-xs font-bold text-foreground hover:bg-chart-2/15 transition-all shadow-sm">
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
          <span>Customize</span>
        </button>
      </div>

      {/* Main Mobbin 2-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Accounts Tree Panel */}
        <div className="lg:col-span-1">
          <AccountsTree accounts={data?.bankAccounts ?? []} holdings={data?.holdings ?? []} totalNetWorth={totalNetWorth} />
        </div>

        {/* Right Column: Net Worth, Transactions, Bills, Income & Spending */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Net Worth Chart Card */}
          <NetWorthChart totalNetWorth={totalNetWorth} />

          {/* Transactions & Bills Row */}
          <div className="grid gap-6 sm:grid-cols-2">
            <RecentTransactionsCard transactions={data?.ledgerTransactions ?? []} />
            <BillsIncomeCard streams={data?.incomeStreams ?? []} />
          </div>

          {/* Income & Spending Summary Row */}
          <IncomeSpendingSummary
            monthlyIncome={data?.me?.monthlyIncome ?? null}
            monthlySpend={data?.me?.monthlySpend ?? null}
            spending30d={data?.spending30d ?? []}
          />
        </div>
      </div>

      {/* Floating Action AI Button - opens AI Twin */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("cartis:open-twin"))}
        className="fixed bottom-8 right-8 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-tr from-primary via-chart-2 to-chart-5 text-white shadow-[0_0_20px_rgba(126,193,81,0.5)] transition-transform duration-300 hover:scale-110 active:scale-95"
        title="Cartis AI Advisor"
      >
        <Sparkles className="h-6 w-6 text-white" />
      </button>
    </div>
  );
}