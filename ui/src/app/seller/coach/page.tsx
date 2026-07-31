import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { coachInsights } from "@/lib/mock-seller";

const TONE: Record<string, { label: string; cls: string }> = {
  warn: { label: "Watch", cls: "bg-amber-400/15 text-amber-400 hover:bg-amber-400/15" },
  good: { label: "Grow", cls: "bg-primary/15 text-primary hover:bg-primary/15" },
  info: { label: "Info", cls: "bg-white/10 text-muted-foreground hover:bg-white/10" },
};

export default function CoachPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Business Coach</h1>
        <p className="mt-1 text-sm text-muted-foreground">AI insights from your numbers — refreshed daily.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {coachInsights.map((c) => {
          const t = TONE[c.tone];
          return (
            <Card key={c.id} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <CardTitle className="text-[15px] leading-snug text-foreground">{c.title}</CardTitle>
                <Badge className={`shrink-0 ${t.cls}`}>{t.label}</Badge>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-[13px] leading-relaxed">{c.detail}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
