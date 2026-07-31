import { AnalysisList } from "@/components/consumer/analysis-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { analyses, purchases } from "@/lib/mock";

const VERDICT_STYLE: Record<string, string> = {
  buy: "bg-primary/15 text-primary hover:bg-primary/15",
  wait: "bg-amber-400/15 text-amber-400 hover:bg-amber-400/15",
  skip: "bg-destructive/15 text-destructive hover:bg-destructive/15",
};

export default function PurchasesPage() {
  const saved = purchases.reduce((s, p) => s + p.saved, 0);
  const decided = purchases.length;
  const followed = purchases.filter((p) => p.verdict === "buy").length;
  const adherence = Math.round((followed / decided) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Purchase Tracker</h1>
        <p className="mt-1 text-sm text-muted-foreground">What you bought, what the coach said, what you saved.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">You saved</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-primary">
            ₹{saved.toLocaleString("en-IN")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Coach adherence</CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-foreground">{adherence}%</span>
            <span className="text-[13px] text-muted-foreground">of {decided} decisions</span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col divide-y divide-border/50 rounded-xl border border-border/50 bg-card">
        {purchases.map((p) => (
          <div key={p.id} className="flex items-center gap-4 px-4 py-3.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-medium text-foreground">{p.product}</span>
              <span className="text-[12px] text-muted-foreground">{p.date}</span>
            </div>
            <span className="text-[13px] text-muted-foreground">₹{p.price.toLocaleString("en-IN")}</span>
            <Badge className={`min-w-12 justify-center ${VERDICT_STYLE[p.verdict]}`}>{p.verdict}</Badge>
          </div>
        ))}
      </div>

      <AnalysisList analyses={analyses} />
    </div>
  );
}
