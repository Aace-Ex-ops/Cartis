import { SpendChart } from "@/components/consumer/spend-chart";
import { CategoryBreakdown } from "@/components/consumer/category-breakdown";
import { TabGauge } from "@/components/consumer/tab-gauge";
import { spending30d, categories, wallet } from "@/lib/mock";

export default function BudgetPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Budget & Spending</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          On track: projected to finish the month at 96% of budget.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TabGauge spend={wallet.monthlySpend} budget={wallet.monthlyBudget} />
        <div className="lg:col-span-2">
          <SpendChart data={spending30d} />
        </div>
      </div>

      <CategoryBreakdown categories={categories} />
    </div>
  );
}
