"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, PackageSearch, SearchX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gql } from "@/lib/gql";
import { SkeletonHeading, SkeletonRow } from "@/components/shared/dashboard-skeleton";

type LedgerTx = {
  txnType: string;
  amount: number;
  description: string | null;
  transactionDate: string | null;
  createdAt: string | null;
};

type Analysis = {
  analysisId: string;
  productName: string;
  price: number;
  verdict: string;
  explanation: string | null;
  createdAt: string;
};

const VERDICT_STYLE: Record<string, string> = {
  buy: "bg-primary/15 text-primary hover:bg-primary/15",
  wait: "bg-amber-500/15 text-amber-600 hover:bg-amber-500/15",
  skip: "bg-destructive/15 text-destructive hover:bg-destructive/15",
};

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function day(iso: string): string {
  const d = new Date(typeof iso === "string" ? iso.replace(" ", "T") : iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchResults />
    </Suspense>
  );
}

function SearchFallback() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonHeading />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [txns, setTxns] = useState<LedgerTx[] | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[] | null>(null);

  useEffect(() => {
    if (!q.trim()) return;
    let cancelled = false;
    const query = `{ ledgerTransactions(search: ${JSON.stringify(q)}, limit: 50) { txnType amount description transactionDate createdAt } analysisHistory(search: ${JSON.stringify(q)}, limit: 50) { analysisId productName price verdict explanation createdAt } }`;
    void gql<{ ledgerTransactions: LedgerTx[]; analysisHistory: Analysis[] }>(query)
      .then((d) => {
        if (!cancelled) {
          setTxns(d.ledgerTransactions);
          setAnalyses(d.analysisHistory);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTxns([]);
          setAnalyses([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  const empty = !q.trim() || (txns !== null && analyses !== null && txns.length === 0 && analyses.length === 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {q ? (
            <>
              Results for <span className="font-medium text-foreground">“{q}”</span>
            </>
          ) : (
            "Type a query in the search bar above and press Enter."
          )}
        </p>
      </div>

      {!q.trim() && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card py-16 text-center">
          <SearchX className="h-6 w-6 text-muted-foreground/60" />
          <p className="text-[13px] text-muted-foreground">Search transactions and purchases from the header.</p>
        </div>
      )}

      {q.trim() && (txns === null || analyses === null) && (
        <div className="flex flex-col gap-6">
          <SkeletonHeading />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>
      )}

      {empty && q.trim() && txns !== null && analyses !== null && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card py-16 text-center">
          <SearchX className="h-6 w-6 text-muted-foreground/60" />
          <p className="text-[13px] text-muted-foreground">
            No transactions or purchases match “{q}”.
          </p>
        </div>
      )}

      {q.trim() && txns !== null && analyses !== null && !empty && (
        <>
          {txns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <PackageSearch className="h-4 w-4" /> Transactions ({txns.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {txns.map((t, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${t.txnType === "debit" ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-600"}`}>
                        {t.txnType === "debit" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                      </span>
                      <div>
                        <div className="text-[13px] font-medium text-foreground">{t.description || "Bank transaction"}</div>
                        <div className="text-[11px] text-muted-foreground">{day(t.transactionDate ?? t.createdAt ?? "")}</div>
                      </div>
                    </div>
                    <div className={`text-[14px] font-semibold ${t.txnType === "debit" ? "text-foreground" : "text-green-600"}`}>
                      {t.txnType === "debit" ? "−" : "+"}{fmt(t.amount)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {analyses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <PackageSearch className="h-4 w-4" /> Purchases ({analyses.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-border/50">
                {analyses.map((a) => (
                  <div key={a.analysisId} className="flex items-center gap-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Link href="/dashboard/analysis" className="truncate text-[14px] font-medium text-foreground hover:underline">
                        {a.productName}
                      </Link>
                      <span className="text-[12px] text-muted-foreground">{a.explanation || day(a.createdAt)}</span>
                    </div>
                    <span className="text-[13px] text-muted-foreground">{fmt(a.price)}</span>
                    <Badge className={`min-w-12 justify-center ${VERDICT_STYLE[a.verdict] ?? "bg-foreground/10 text-muted-foreground"}`}>
                      {a.verdict}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
