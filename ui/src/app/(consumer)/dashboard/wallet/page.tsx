"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletCard } from "@/components/consumer/wallet-card";
import { SetuConnect } from "@/components/shared/setu-connect";
import { gql } from "@/lib/gql";

type BankAccount = {
  accountId: string;
  bankName: string;
  mobileNumber: string | null;
  balance: number | null;
  lastSyncAt: string | null;
  isPrimary: boolean;
};

const QUERY = `{
  bankAccounts { accountId bankName mobileNumber balance lastSyncAt isPrimary }
  monthlyTab { limit spent }
}`;

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function formatSync(iso: string | null): string {
  if (!iso) return "Never synced";
  return new Date(iso.replace(" ", "T")).toLocaleString("en-IN", {
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
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void gql<{ bankAccounts: BankAccount[]; monthlyTab: { limit: number; spent: number } }>(QUERY)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ bankAccounts: [], monthlyTab: { limit: 0, spent: 0 } });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const balance = data?.bankAccounts[0]?.balance ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Wallet</h1>
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
          <CardTitle className="text-sm font-medium">Connected accounts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data?.bankAccounts.map((a) => (
            <div key={a.accountId} className="flex items-center gap-3 rounded-lg border p-3">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.bankName}</p>
                <p className="text-xs text-muted-foreground">
                  {a.balance != null ? fmt(a.balance) : "—"} · {formatSync(a.lastSyncAt)}
                </p>
              </div>
              {a.isPrimary && (
                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Primary</span>
              )}
            </div>
          ))}
          {!data?.bankAccounts.length && (
            <p className="text-sm text-muted-foreground">No accounts connected yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Sync transactions</CardTitle>
          <CardDescription>Connect your bank via Account Aggregator — no passwords needed.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SetuConnect />
        </CardContent>
      </Card>
    </div>
  );
}
