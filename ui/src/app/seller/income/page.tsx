import { IncomeChart } from "@/components/seller/income-chart";
import { CategoryBreakdown } from "@/components/consumer/category-breakdown";
import { StatCard } from "@/components/seller/stat-card";
import { TrendingUp } from "lucide-react";
import { income6m, incomeCategories } from "@/lib/mock-seller";

export default function IncomePage() {
  const first = income6m[0].income;
  const last = income6m[income6m.length - 1].income;
  const growth = Math.round(((last - first) / first) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Income</h1>
        <p className="mt-1 text-sm text-muted-foreground">Where the money comes from.</p>
      </div>
      <StatCard title="6-month growth" value={`+${growth}%`} icon={<TrendingUp className="h-4 w-4 text-primary" />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IncomeChart data={income6m} />
        </div>
        <CategoryBreakdown categories={incomeCategories} />
      </div>
    </div>
  );
}
