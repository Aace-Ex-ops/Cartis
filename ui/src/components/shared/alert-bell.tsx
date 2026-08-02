"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AlertBell({
  alerts = [],
}: {
  alerts?: { id: string; title: string; time: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="relative rounded-md p-2 text-muted-foreground outline-none transition-colors hover:bg-white/5 hover:text-foreground focus:ring-1 focus:ring-primary">
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
        {alerts.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {alerts.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Alerts
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {alerts.length === 0 ? (
          <div className="px-3 py-6 text-center text-[13px] text-muted-foreground">
            No new alerts
          </div>
        ) : (
          alerts.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-0.5 px-3 py-2.5 text-[13px] transition-colors hover:bg-white/5"
            >
              <span className="text-foreground">{a.title}</span>
              <span className="text-[11px] text-muted-foreground">{a.time}</span>
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
