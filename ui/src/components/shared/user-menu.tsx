"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { SubscriptionPanel } from "@/components/consumer/subscription-panel";
const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type User = {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  userType: string;
};

type PanelKey = "subscription";

const PANELS: Record<PanelKey, { label: string; panel: React.ComponentType<{ effectivePlan?: string; userType?: string }> }> = {
  subscription: { label: "Subscription", panel: SubscriptionPanel },
};

export function UserMenu({
  user,
  collapsed = false,
  effectivePlan,
  userType,
}: {
  user: User;
  collapsed?: boolean;
  effectivePlan?: string;
  userType?: string;
}) {
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);

  const isBusiness = user.userType === "business" || user.userType === "seller";

  const initials = user.fullName
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "…";

  const ActivePanel = openPanel ? PANELS[openPanel].panel : null;
  const panelProps = { effectivePlan: effectivePlan ?? "free", userType: userType ?? user.userType };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {collapsed ? (
            <button
              title={user.fullName}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl p-1 transition-all focus:outline-none"
            >
              <Avatar className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground after:border-0">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName} />
                <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          ) : (
            <button className="flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all hover:bg-white/10 focus:outline-none">
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar className="h-8 w-8 shrink-0 rounded-lg bg-primary text-primary-foreground after:border-0">
                  <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName} />
                  <AvatarFallback className="bg-primary text-[12px] font-semibold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-medium text-foreground">{user.fullName}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{user.email}</span>
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 shadow-none ring-0">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-foreground">{user.fullName}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {isBusiness ? "Business" : "Personal finance"}
            </span>
          </div>
          <DropdownMenuSeparator />
          {(Object.keys(PANELS) as PanelKey[]).map((key) => (
            <DropdownMenuItem key={key} onClick={() => setOpenPanel(key)} className="cursor-pointer">
              {PANELS[key].label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => { window.location.href = `${GATEWAY}/auth/logout`; }} className="text-destructive focus:text-destructive">
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openPanel !== null} onOpenChange={(v) => { if (!v) setOpenPanel(null); }}>
        <DialogContent className="max-w-3xl h-[min(640px,calc(100vh-3rem))] flex flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">
            {ActivePanel && <ActivePanel {...panelProps} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
