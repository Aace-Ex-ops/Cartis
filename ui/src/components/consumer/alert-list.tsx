"use client";

import { AlertTriangle, AlertCircle, Info, BellRing } from "lucide-react";

const SEVERITY_ICON = {
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
} as const;

const SEVERITY_COLOR = {
  high: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-teal-400 bg-teal-500/10 border-teal-500/20",
} as const;

export function AlertList({
  alerts,
}: {
  alerts: { id: string; title: string; time: string; severity: "high" | "medium" | "low" }[];
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-teal-400/40 hover:shadow-2xl">
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-teal-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            Realtime Radar
          </h3>
        </div>
        <span className="rounded-full bg-teal-500/10 border border-teal-400/20 px-2 py-0.5 text-[11px] font-semibold text-teal-300">
          {alerts.length} Active
        </span>
      </div>

      <div className="mt-3 flex flex-col divide-y divide-border/30">
        {alerts.map((a) => {
          const Icon = SEVERITY_ICON[a.severity];
          return (
            <div
              key={a.id}
              className="flex items-start gap-3 py-3.5 first:pt-1 last:pb-0 transition-colors hover:bg-white/5 px-2 rounded-xl"
            >
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${SEVERITY_COLOR[a.severity]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-[13px] font-medium leading-snug text-foreground">{a.title}</span>
                <span className="text-[11px] text-muted-foreground">{a.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
