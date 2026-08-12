"use client";

import { useCallback, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletCard } from "@/components/consumer/wallet-card";
import { AaLinkRest, AaReconnect } from "@/components/consumer/aa-connect";
import { gql } from "@/lib/gql";
import { useLiveData } from "@/lib/use-live-data";
import { SkeletonHeading, SkeletonCard, SkeletonRow } from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

type BankAccount = {
  accountId: string;
  bankName: string;
  mobileNumber: string | null;
  balance: number | null;
  lastSyncAt: string | null;
  isPrimary: boolean;
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

const QUERY = `{
  bankAccounts { accountId bankName mobileNumber balance lastSyncAt isPrimary }
  monthlyTab { limit spent }
  aaConnections { aaHandle consentStatus fipId lastFetchedAt bankName }
  ledgerTransactions(limit: 10) { txnType amount description transactionDate createdAt }
  incomeStreams { source frequency amount currency fromDate toDate }
  me { monthlyIncome monthlySpend investmentPct housingCost debtEmis monthlyTax }
}`;

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function formatSync(iso: string | null): string {
  if (!iso) return "Never synced";
  const d = new Date(typeof iso === "string" ? iso.replace(" ", "T") : iso);
  if (Number.isNaN(d.getTime())) return "Never synced";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WalletPage() {
  const [data, setData] = useState<{
    bankAccounts: BankAccount[];
    monthlyTab: { limit: number; spent: number };
    aaConnections: { aaHandle: string; consentStatus: string; fipId: string | null; lastFetchedAt: string | null; bankName: string | null }[];
    ledgerTransactions: LedgerTx[];
    incomeStreams: { source: string; frequency: string; amount: number; currency: string; fromDate: string | null; toDate: string | null }[];
    me: MeProfile | null;
  } | null>(null);

  const load = useCallback(async () => {
    void gql<{
      bankAccounts: BankAccount[];
      monthlyTab: { limit: number; spent: number };
      aaConnections: { aaHandle: string; consentStatus: string; fipId: string | null; lastFetchedAt: string | null; bankName: string | null }[];
      ledgerTransactions: LedgerTx[];
      incomeStreams: { source: string; frequency: string; amount: number; currency: string; fromDate: string | null; toDate: string | null }[];
      me: MeProfile | null;
    }>(QUERY)
      .then((d) => setData(d))
      .catch(() => setData({ bankAccounts: [], monthlyTab: { limit: 0, spent: 0 }, aaConnections: [], ledgerTransactions: [], incomeStreams: [], me: null }));
  }, []);

  useLiveData(load, [load]);

  if (data === null) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonHeading />
        <SkeletonCard className="h-[190px]" />
        <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4">
          <Skeleton className="h-4 w-40" />
          <SkeletonRow bare />
          <SkeletonRow bare />
        </div>
      </div>
    );
  }

  const balance = data?.bankAccounts[0]?.balance ?? null;
  const aaConn = data?.aaConnections?.[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your money across connected accounts.</p>
      </div>

      {data && (
        <WalletCard
          balance={balance ?? 0}
          monthlySpend={data.monthlyTab.spent}
          monthlyBudget={data.monthlyTab.limit}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Landmark className="h-4 w-4" /> Connected accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data === null && <div className="h-20 rounded-lg border border-border/50" />}
          {data !== null && (data.bankAccounts ?? []).length === 0 && (
            <p className="rounded-lg border border-border/50 bg-background/50 px-4 py-6 text-center text-[13px] text-muted-foreground">
              No bank connected yet — use Account Aggregator to link your bank.
            </p>
          )}
          {data?.bankAccounts.map((a) => (
            <div
              key={a.accountId}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-foreground">{a.bankName}</span>
                  {a.isPrimary && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                      Primary
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  synced {formatSync(a.lastSyncAt)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[16px] font-semibold text-foreground">
                  {a.balance != null ? fmt(a.balance) : "—"}
                </div>
                <div className="text-[11px] text-muted-foreground">Balance</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {aaConn && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Account Aggregator</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-4 py-3">
              <div>
                <div className="text-[14px] font-medium text-foreground">{aaConn.aaHandle}</div>
                <div className="text-[12px] text-muted-foreground">
                  {aaConn.consentStatus === "ACCEPTED" ? "Active" : aaConn.consentStatus}
                  {aaConn.bankName ? ` · ${aaConn.bankName}` : ""}
                  {aaConn.lastFetchedAt ? ` · last synced ${formatSync(aaConn.lastFetchedAt)}` : ""}
                </div>
              </div>
            </div>
            <AaReconnect onSynced={() => {
              // Reload data after re-sync
              void gql<{
                bankAccounts: BankAccount[];
                monthlyTab: { limit: number; spent: number };
                aaConnections: { aaHandle: string; consentStatus: string; fipId: string | null; lastFetchedAt: string | null; bankName: string | null }[];
                ledgerTransactions: LedgerTx[];
                incomeStreams: { source: string; frequency: string; amount: number; currency: string; fromDate: string | null; toDate: string | null }[];
                me: MeProfile | null;
              }>(QUERY).then(setData).catch(() => {});
            }} />
            <AaLinkRest onSynced={() => {
              void gql<{
                bankAccounts: BankAccount[];
                monthlyTab: { limit: number; spent: number };
                aaConnections: { aaHandle: string; consentStatus: string; fipId: string | null; lastFetchedAt: string | null; bankName: string | null }[];
                ledgerTransactions: LedgerTx[];
                incomeStreams: { source: string; frequency: string; amount: number; currency: string; fromDate: string | null; toDate: string | null }[];
                me: MeProfile | null;
              }>(QUERY).then(setData).catch(() => {});
            }} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ArrowUpRight className="h-4 w-4" /> Recent transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(data.ledgerTransactions ?? []).length === 0 && (
            <p className="rounded-lg border border-border/50 bg-background/50 px-4 py-6 text-center text-[13px] text-muted-foreground">
              No transactions yet — they appear after linking a bank with transaction history.
            </p>
          )}
          {data.ledgerTransactions.map((t, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${t.txnType === "debit" ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-600"}`}>
                  {t.txnType === "debit" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                </span>
                <div>
                  <div className="text-[13px] font-medium text-foreground">{t.description || "Bank transaction"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t.transactionDate ? t.transactionDate.slice(0, 10) : (t.createdAt ? t.createdAt.slice(0, 10) : "")}
                  </div>
                </div>
              </div>
              <div className={`text-[14px] font-semibold ${t.txnType === "debit" ? "text-foreground" : "text-green-600"}`}>
                {t.txnType === "debit" ? "−" : "+"}{fmt(t.amount)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Wallet2 className="h-4 w-4" /> Financial profile
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Monthly income", value: data.me?.monthlyIncome != null ? fmt(data.me.monthlyIncome) : "—" },
            { label: "Monthly spend", value: data.me?.monthlySpend != null ? fmt(data.me.monthlySpend) : "—" },
            { label: "Investment", value: data.me?.investmentPct != null ? `${data.me.investmentPct}%` : "—" },
            { label: "Housing", value: data.me?.housingCost != null ? fmt(data.me.housingCost) : "—" },
            { label: "Debt EMIs", value: data.me?.debtEmis != null ? fmt(data.me.debtEmis) : "—" },
            { label: "Monthly tax", value: data.me?.monthlyTax != null ? fmt(data.me.monthlyTax) : "—" },
          ].map((row) => (
            <div key={row.label} className="rounded-lg border border-border/50 bg-background/50 px-4 py-3">
              <div className="text-[11px] text-muted-foreground">{row.label}</div>
              <div className="mt-0.5 text-[15px] font-semibold text-foreground">{row.value}</div>
            </div>
          ))}
          {(data.incomeStreams ?? []).length > 0 && (
            <div className="col-span-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 sm:col-span-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-primary">Income sources</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {data.incomeStreams.map((s, i) => (
                  <span key={i} className="rounded-full bg-background/70 px-2.5 py-1 text-[12px] text-foreground">
                    {s.source || "Income"} · {fmt(s.amount)}{s.frequency !== "MONTHLY" ? ` / ${s.frequency.toLowerCase()}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!aaConn && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6">
            <p className="text-[13px] text-muted-foreground text-center">
              Sync your linked bank accounts to pull balances into Cartis.
            </p>
            <AaReconnect onSynced={() => {
              void gql<{
                bankAccounts: BankAccount[];
                monthlyTab: { limit: number; spent: number };
                aaConnections: { aaHandle: string; consentStatus: string; fipId: string | null; lastFetchedAt: string | null; bankName: string | null }[];
                ledgerTransactions: LedgerTx[];
                incomeStreams: { source: string; frequency: string; amount: number; currency: string; fromDate: string | null; toDate: string | null }[];
                me: MeProfile | null;
              }>(QUERY).then(setData).catch(() => {});
            }} />
            <AaLinkRest onSynced={() => {
              void gql<{
                bankAccounts: BankAccount[];
                monthlyTab: { limit: number; spent: number };
                aaConnections: { aaHandle: string; consentStatus: string; fipId: string | null; lastFetchedAt: string | null; bankName: string | null }[];
                ledgerTransactions: LedgerTx[];
                incomeStreams: { source: string; frequency: string; amount: number; currency: string; fromDate: string | null; toDate: string | null }[];
                me: MeProfile | null;
              }>(QUERY).then(setData).catch(() => {});
            }} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
