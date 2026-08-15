"use client";

import { ArrowRightLeft } from "lucide-react";

export type LedgerTx = {
  txnType: string;
  amount: number;
  description: string | null;
  transactionDate: string | null;
};

export function RecentTransactionsCard({ transactions }: { transactions: LedgerTx[] }) {
  const moneySpent = transactions
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + t.amount, 0);
  const head = transactions.slice(0, 5).map((t) => ({
    id: t.txnType + t.transactionDate + t.amount,
    name: t.description ?? t.txnType,
    subtitle: t.txnType,
    amount: t.amount,
    date: t.transactionDate?.slice(0, 10) ?? "",
  }));

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div>
          <h3 className="text-base font-bold text-[#132a13]">Recent Transactions</h3>
          <p className="text-xs text-gray-500">₹{Math.abs(moneySpent).toLocaleString("en-IN", { minimumFractionDigits: 2 })} spent recently</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-gray-100">
        {head.map((t) => (
          <div key={t.id} className="flex items-center justify-between py-3 transition-colors hover:bg-[#b2d959]/10 px-1 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#b2d959]/30 border border-[#7ec151]/20 text-[#132a13]">
                <ArrowRightLeft className="h-4 w-4 text-[#7ec151]" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#132a13]">{t.name}</span>
                <span className="text-xs text-gray-500">{t.subtitle}</span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-sm font-bold tabular-nums text-[#132a13]">
                ₹{t.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-gray-400">{t.date}</span>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-4 w-full rounded-xl bg-[#b2d959]/30 hover:bg-[#b2d959]/50 border border-[#7ec151]/30 py-2.5 text-xs font-bold text-[#132a13] transition-all">
        See all other Transactions
      </button>
    </div>
  );
}
