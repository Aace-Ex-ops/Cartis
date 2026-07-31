import { StatCard } from "@/components/seller/stat-card";
import { TrendingUp, Wallet, Percent, Landmark } from "lucide-react";
import { sellerOverview } from "@/lib/mock-seller";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function SellerDashboardPage() {
  const revDelta = Math.round(((sellerOverview.revenue - sellerOverview.lastMonth.revenue) / sellerOverview.lastMonth.revenue) * 100);
  const expDelta = Math.round(((sellerOverview.expenses - sellerOverview.lastMonth.expenses) / sellerOverview.lastMonth.expenses) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Business Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your shop at a glance — July 2026.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Revenue" value={fmt(sellerOverview.revenue)} delta={{ pct: revDelta, direction: "up" }} icon={<TrendingUp className="h-4 w-4 text-primary" />} />
        <StatCard title="Expenses" value={fmt(sellerOverview.expenses)} delta={{ pct: expDelta, direction: "up", good: false }} icon={<Wallet className="h-4 w-4 text-destructive" />} />
        <StatCard title="Profit margin" value={`${sellerOverview.profitMargin}%`} icon={<Percent className="h-4 w-4 text-primary" />} />
        <StatCard title="Cash on hand" value={fmt(sellerOverview.cashOnHand)} icon={<Landmark className="h-4 w-4 text-muted-foreground" />} />
      </div>
    </div>
  );
}
