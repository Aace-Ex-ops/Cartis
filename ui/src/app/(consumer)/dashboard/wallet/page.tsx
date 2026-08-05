"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletCard } from "@/components/consumer/wallet-card";
import { AaReconnect } from "@/components/consumer/aa-connect";
import { gql } from "@/lib/gql";

type BankAccount = {
  accountId: string;
  bankName: string;
  mobileNumber: string | null;
  balance: number | null;
  lastSyncAt: string | null;
};

const QUERY = `{
  bankAccounts { accountId bankName mobileNumber balance lastSyncAt }
  monthlyTab { limit spent }
  aaConnections { aaHandle consentStatus fipId lastFetchedAt bankName }
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
    aaConnections: { aaHandle: string; consentStatus: string; fipId: string | null; lastFetchedAt: string | null; bankName: string | null }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void gql<{
      bankAccounts: BankAccount[];
      monthlyTab: { limit: number; spent: number };
      aaConnections: { aaHandle: string; consentStatus: string; fipId: string | null; lastFetchedAt: string | null; bankName: string | null }[];
    }>(QUERY)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ bankAccounts: [], monthlyTab: { limit: 0, spent: 0 }, aaConnections: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const balance = data?.bankAccounts[0]?.balance ?? null;
  const aaConn = data?.aaConnections?.[0];

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
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Landmark className="h-4 w-4" /> Connected accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data === null && <div className="h-20 rounded-lg border border-border/50" />}
          {data !== null && data.bankAccounts.length === 0 && (
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
                <div className="text-[14px] font-medium text-foreground">{a.bankName}</div>
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
              }>(QUERY).then(setData).catch(() => {});
            }} />
          </CardContent>
        </Card>
      )}

      {!aaConn && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6">
            <p className="text-[13px] text-muted-foreground text-center">
              Connect your bank via Account Aggregator to sync transactions automatically.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
