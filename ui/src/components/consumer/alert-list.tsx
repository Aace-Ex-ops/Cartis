import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SEVERITY_ICON = {
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
} as const;

const SEVERITY_COLOR = {
  high: "text-destructive",
  medium: "text-amber-600",
  low: "text-primary",
} as const;

export function AlertList({ alerts }: {
  alerts: { id: string; title: string; time: string; severity: "high" | "medium" | "low" }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border/50">
        {alerts.map((a) => {
          const Icon = SEVERITY_ICON[a.severity];
          return (
            <div key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_COLOR[a.severity]}`} strokeWidth={1.5} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] leading-snug text-foreground">{a.title}</span>
                <span className="text-[11px] text-muted-foreground">{a.time}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
