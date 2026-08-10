import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

export function StatCard({
  title,
  value,
  delta,
  icon,
}: {
  title: string;
  value: string;
  delta?: { pct: number; direction: "up" | "down"; good?: boolean };
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        {delta && (
          <div className="flex items-center gap-1 text-[13px]">
            {delta.direction === "up" ? (
              <TrendingUp className={`h-3.5 w-3.5 ${delta.good === false ? "text-destructive" : "text-primary"}`} />
            ) : (
              <TrendingDown className={`h-3.5 w-3.5 ${delta.good ? "text-primary" : "text-destructive"}`} />
            )}
            <span className={delta.good === false ? "text-destructive" : "text-primary"}>
              {delta.pct}%
            </span>
            <span className="text-muted-foreground">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
