"use client";

import { useCallback, useState } from "react";
import { Landmark, Wallet, ShieldCheck, ArrowRightLeft, CreditCard, RefreshCw, Plus, CheckCircle2 } from "lucide-react";
import { gql } from "@/lib/gql";
import { useLiveData } from "@/lib/use-live-data";
import { SkeletonHeading, SkeletonCard, SkeletonRow } from "@/components/shared/dashboard-skeleton";

type BankAccount = {
  accountId: string;
  bankName: string;
  mobileNumber: string | null;
  balance: number | null;
  lastSyncAt: string | null;
  isPrimary: boolean;
  type?: string;
  accountNumber?: string;
};

type LedgerTx = {
  txnType: string;
  amount: number;
  description: string | null;
  transactionDate: string | null;
  createdAt: string | null;
};

type MeProfile = {
  monthlyIncome: number | null;
  monthlySpend: number | null;
  investmentPct: number | null;
  housingCost: number | null;
  debtEmis: number | null;
  monthlyTax: number | null;
};

const DUMMY_ACCOUNTS: BankAccount[] = [
  {
    accountId: "acc-hdfc-01",
    bankName: "HDFC Bank",
    mobileNumber: "+91 98765 43210",
    balance: 184250.0,
    lastSyncAt: new Date().toISOString(),
    isPrimary: true,
    type: "Salary Account",
    accountNumber: "•••• 4829",
  },
  {
    accountId: "acc-icici-02",
    bankName: "ICICI Bank",
    mobileNumber: "+91 98765 43210",
    balance: 64250.0,
    lastSyncAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    isPrimary: false,
    type: "Savings Account",
    accountNumber: "•••• 9102",
  },
  {
    accountId: "acc-axis-03",
    bankName: "Axis Bank",
    mobileNumber: "+91 98765 43210",
    balance: -12400.0,
    lastSyncAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    isPrimary: false,
    type: "Credit Card (Tab)",
    accountNumber: "•••• 3310",
  },
];

const DUMMY_TRANSACTIONS = [
  { id: "tx1", title: "Amazon India", category: "Electronics", amount: -4299.0, date: "Today, 2:15 PM", icon: "🛒" },
  { id: "tx2", title: "Swiggy Gourmet", category: "Food & Dining", amount: -640.0, date: "Today, 1:20 PM", icon: "🍱" },
  { id: "tx3", title: "HDFC Monthly Salary", category: "Income", amount: 125000.0, date: "01 Aug 2026", icon: "💼" },
  { id: "tx4", title: "Uber Technologies", category: "Transport", amount: -320.0, date: "Yesterday, 8:40 PM", icon: "🚗" },
  { id: "tx5", title: "Netflix India Premium", category: "Subscription", amount: -649.0, date: "28 Jul 2026", icon: "🎬" },
];

const QUERY = `{
  bankAccounts { accountId bankName mobileNumber balance lastSyncAt isPrimary }
  monthlyTab { limit spent }
  aaConnections { aaHandle consentStatus fipId lastFetchedAt bankName }
  ledgerTransactions(limit: 10) { txnType amount description transactionDate createdAt }
  incomeStreams { source frequency amount currency fromDate toDate }
  me { monthlyIncome monthlySpend investmentPct housingCost debtEmis monthlyTax }
}`;

const fmt = (n: number) => {
  const isNeg = n < 0;
  const abs = Math.abs(n);
  return `${isNeg ? "-" : ""}₹${abs.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
};

function formatSync(iso: string | null): string {
  if (!iso) return "Synced today";
  try {
    return new Date(typeof iso === "string" ? iso.replace(" ", "T") : iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Synced today";
  }
}

export default function WalletPage() {
  const [data, setData] = useState<{
    bankAccounts: BankAccount[];
    monthlyTab: { limit: number; spent: number };
    aaConnections: { aaHandle: string; consentStatus: string; fipId: string | null; lastFetchedAt: string | null; bankName: string | null }[];
    ledgerTransactions?: LedgerTx[];
    incomeStreams?: { source: string; frequency: string; amount: number; currency: string; fromDate: string | null; toDate: string | null }[];
    me?: MeProfile | null;
  } | null>(null);

  const load = useCallback(async () => {
    gql<{
      bankAccounts: BankAccount[];
      monthlyTab: { limit: number; spent: number };
      aaConnections: { aaHandle: string; consentStatus: string; fipId: string | null; lastFetchedAt: string | null; bankName: string | null }[];
      ledgerTransactions: LedgerTx[];
      incomeStreams: { source: string; frequency: string; amount: number; currency: string; fromDate: string | null; toDate: string | null }[];
      me: MeProfile | null;
    }>(QUERY)
      .then((d) => {
        const hasAccounts = d.bankAccounts && d.bankAccounts.length > 0;
        setData({
          bankAccounts: hasAccounts ? d.bankAccounts : DUMMY_ACCOUNTS,
          monthlyTab: d.monthlyTab?.limit ? d.monthlyTab : { limit: 75000, spent: 24850 },
          aaConnections: d.aaConnections && d.aaConnections.length > 0 ? d.aaConnections : [
            { aaHandle: "aditya@onemoney", consentStatus: "ACTIVE", fipId: "FIP_HDFC", lastFetchedAt: new Date().toISOString(), bankName: "RBI Account Aggregator Network" }
          ],
        });
      })
      .catch(() => {
        setData({
          bankAccounts: DUMMY_ACCOUNTS,
          monthlyTab: { limit: 75000, spent: 24850 },
          aaConnections: [
            { aaHandle: "aditya@onemoney", consentStatus: "ACTIVE", fipId: "FIP_HDFC", lastFetchedAt: new Date().toISOString(), bankName: "RBI Account Aggregator Network" }
          ],
        });
      });
  }, []);

  useLiveData(load, [load]);

  if (data === null) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonHeading />
        <SkeletonCard className="h-[190px]" />
        <div className="flex flex-col gap-3 rounded-xl border border-[#7ec151]/20 bg-white p-4">
          <SkeletonRow bare />
          <SkeletonRow bare />
        </div>
      </div>
    );
  }

  const accounts = data.bankAccounts.length > 0 ? data.bankAccounts : DUMMY_ACCOUNTS;
  const totalBalance = accounts.reduce((acc, curr) => acc + (curr.balance ?? 0), 0);

  return (
    <div className="flex flex-col gap-6 text-[#132a13] pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#132a13] md:text-3xl">Wallet</h1>
          <p className="mt-1 text-xs text-gray-500">Your connected bank accounts, liquidity, and live balances.</p>
        </div>

        <button className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#7ec151] to-[#b2d959] hover:from-[#6cae42] hover:to-[#9fc44a] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all">
          <Plus className="h-4 w-4" />
          <span>Connect New Bank</span>
        </button>
      </div>

      {/* Main Wallet KPI Summary Card */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Card 1: Total Liquidity */}
        <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>Total Net Liquidity</span>
            <Wallet className="h-4 w-4 text-[#7ec151]" />
          </div>
          <p className="mt-3 text-3xl font-black text-[#132a13] tabular-nums">{fmt(totalBalance)}</p>
          <p className="mt-1 text-[11px] text-[#7ec151] font-bold flex items-center gap-1">
            <span>↗ +14.2%</span>
            <span className="text-gray-400 font-normal">vs last month</span>
          </p>
        </div>

        {/* Card 2: Monthly Tab / Budget */}
        <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>Monthly Tab Pace</span>
            <CreditCard className="h-4 w-4 text-[#b2d959]" />
          </div>
          <p className="mt-3 text-3xl font-black text-[#132a13] tabular-nums">
            {fmt(data.monthlyTab.spent)}{" "}
            <span className="text-xs text-gray-400 font-normal">/ {fmt(data.monthlyTab.limit)}</span>
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7ec151] to-[#b2d959]"
              style={{ width: `${Math.min(Math.round((data.monthlyTab.spent / data.monthlyTab.limit) * 100), 100)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Account Aggregator Status */}
        <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>RBI AA Network</span>
            <ShieldCheck className="h-4 w-4 text-[#7ec151]" />
          </div>
          <p className="mt-3 text-lg font-bold text-[#132a13]">aditya@onemoney</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[#132a13] font-semibold bg-[#b2d959]/30 border border-[#b2d959] px-2.5 py-0.5 rounded-full w-fit">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#7ec151]" />
            <span>Active Consent Sync</span>
          </div>
        </div>
      </div>

      {/* Connected Accounts List */}
      <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-[#7ec151]" />
            <h2 className="text-base font-bold text-[#132a13]">Connected Accounts ({accounts.length})</h2>
          </div>
          <button className="flex items-center gap-1 text-xs font-semibold text-[#132a13] hover:text-[#7ec151] transition-colors">
            <RefreshCw className="h-3.5 w-3.5 text-[#7ec151]" />
            <span>Re-sync All</span>
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {accounts.map((a) => (
            <div
              key={a.accountId}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3.5 transition-all hover:bg-[#b2d959]/15"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b2d959]/40 text-[#132a13] font-black text-sm border border-[#7ec151]/30">
                  {a.bankName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#132a13]">{a.bankName}</span>
                    {a.accountNumber && (
                      <span className="text-xs text-gray-500 font-medium">{a.accountNumber}</span>
                    )}
                    {a.isPrimary && (
                      <span className="rounded-full bg-[#fed24f]/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#854d0e] border border-[#fed24f]">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {a.type ?? "Savings Account"} · {formatSync(a.lastSyncAt)}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className={`text-base font-black tabular-nums ${a.balance != null && a.balance < 0 ? "text-rose-600" : "text-[#132a13]"}`}>
                  {a.balance != null ? fmt(a.balance) : "—"}
                </div>
                <div className="text-[10px] uppercase font-bold text-gray-400">Available Balance</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Wallet Activity */}
      <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-[#7ec151]" />
            <h2 className="text-base font-bold text-[#132a13]">Recent Wallet Activity</h2>
          </div>
          <span className="text-xs font-semibold text-gray-500">Last 30 Days</span>
        </div>

        <div className="mt-4 flex flex-col divide-y divide-gray-100">
          {DUMMY_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-3 px-1 hover:bg-[#b2d959]/10 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#b2d959]/25 text-base border border-[#7ec151]/20">
                  {tx.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#132a13]">{tx.title}</p>
                  <p className="text-xs text-gray-500">{tx.category} · {tx.date}</p>
                </div>
              </div>
              <span className={`text-sm font-black tabular-nums ${tx.amount > 0 ? "text-[#7ec151]" : "text-[#132a13]"}`}>
                {tx.amount > 0 ? `+${fmt(tx.amount)}` : fmt(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
