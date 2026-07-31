import { CashFlowChart } from "@/components/seller/cashflow-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { cashflow } from "@/lib/mock-seller";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function CashFlowPage() {
  const avgIn = cashflow.reduce((s, m) => s + m.in, 0) / cashflow.length;
  const avgOut = cashflow.reduce((s, m) => s + m.out, 0) / cashflow.length;
  const surplus = Math.round(avgIn - avgOut);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cash Flow</h1>
        <p className="mt-1 text-sm text-muted-foreground">Money in, money out, and what is left.</p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="flex flex-col">
          <span className="text-[14px] text-foreground">Outflows are growing faster than inflows</span>
          <span className="text-[12px] text-muted-foreground">Expenses grew 27% since Feb vs 52% revenue growth — watch rent + materials</span>
        </div>
      </div>

      <CashFlowChart data={cashflow} />

      <Card>
        <CardHeader>
          <CardTitle>Surplus projection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-primary">+{fmt(surplus)}</div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Average monthly surplus over the last 6 months — enough to cover a slow quarter.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
