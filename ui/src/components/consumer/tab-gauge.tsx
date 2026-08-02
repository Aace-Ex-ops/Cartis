import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function TabGauge({ spend, budget }: { spend: number; budget: number }) {
  const pct = budget > 0 ? Math.round((spend / budget) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Monthly tab</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        {budget > 0 ? (
          <div
            className="relative flex h-28 w-28 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(${pct > 90 ? "#ef4444" : "#10b981"} ${pct * 3.6}deg, rgba(255,255,255,0.06) 0deg)` }}
          >
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-card">
              <span className="text-xl font-semibold text-foreground">{pct}%</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">used</span>
            </div>
          </div>
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/5">
            <span className="text-[13px] text-muted-foreground">No budget</span>
          </div>
        )}
        <div className="text-[13px] text-muted-foreground">
          {fmt(spend)} of {fmt(budget)} this month
        </div>
      </CardContent>
    </Card>
  );
}
