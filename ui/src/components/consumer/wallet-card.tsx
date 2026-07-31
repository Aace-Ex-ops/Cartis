import { Wallet, Sparkles, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function WalletCard({ balance, credits, monthlySpend, monthlyBudget }: {
  balance: number;
  credits: number;
  monthlySpend: number;
  monthlyBudget: number;
}) {
  const usedPct = Math.round((monthlySpend / monthlyBudget) * 100);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">Wallet</CardTitle>
        <Wallet className="h-4 w-4 text-muted-foreground/60" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="text-2xl font-semibold text-foreground">{fmt(balance)}</div>
          <div className="text-[12px] text-muted-foreground">Available balance</div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-[13px] text-primary">
          <Sparkles className="h-4 w-4" strokeWidth={1.5} />
          {credits} coach credits
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5" />
            This month
          </span>
          <span className="text-foreground">
            {fmt(monthlySpend)} <span className="text-muted-foreground">/ {fmt(monthlyBudget)}</span>
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full rounded-full ${usedPct > 90 ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${Math.min(usedPct, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
