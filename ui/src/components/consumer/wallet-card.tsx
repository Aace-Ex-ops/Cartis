import { Wallet, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function WalletCard({ balance, monthlySpend, monthlyBudget }: {
  balance: number;
  monthlySpend: number;
  monthlyBudget: number;
}) {
  const usedPct = monthlyBudget > 0 ? Math.round((monthlySpend / monthlyBudget) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">Wallet</CardTitle>
        <Wallet className="h-4 w-4 text-muted-foreground/60" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="text-2xl font-semibold tabular-nums text-foreground">{fmt(balance)}</div>
          <div className="text-[12px] text-muted-foreground">Bank balance</div>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5" />
            This month
          </span>
          {monthlyBudget > 0 ? (
            <span className="text-foreground">
              <span className="tabular-nums">{fmt(monthlySpend)} <span className="text-muted-foreground">/ {fmt(monthlyBudget)}</span></span>
            </span>
          ) : (
            <span className="text-muted-foreground">No budget set</span>
          )}
        </div>
        {monthlyBudget > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-foreground/5">
            <div
              className={`h-full rounded-full ${usedPct > 90 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${Math.min(usedPct, 100)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
