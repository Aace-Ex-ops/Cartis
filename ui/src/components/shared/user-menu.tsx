"use client";

import { useEffect, useState } from "react";
import { Repeat, ChevronDown } from "lucide-react";
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
import { SettingsPanel } from "@/components/consumer/settings-panel";
import { gql } from "@/lib/gql";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type User = {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  userType: string;
};

type PanelKey = "subscription" | "settings";

const PANELS: Record<PanelKey, { label: string; panel: React.ComponentType }> = {
  subscription: { label: "Subscription", panel: SubscriptionPanel },
  settings: { label: "Settings", panel: SettingsPanel },
};

export function UserMenu({ user }: { user: User }) {
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const [userType, setUserType] = useState(user.userType);

  useEffect(() => {
    let cancelled = false;
    void gql<{ me?: { userType?: string } | null }>("{ me { userType } }")
      .then((d) => {
        if (!cancelled && d.me?.userType) setUserType(d.me.userType);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const isBusiness = userType === "business" || userType === "seller";

  async function switchType(next: "personal" | "business") {
    try {
      await gql<unknown>(`mutation { updateUserType(userType: "${next}") { id } }`);
      window.location.reload();
    } catch {
      // keep current state; retry next open
    }
  }

  const initials = user.fullName
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "…";

  const ActivePanel = openPanel ? PANELS[openPanel].panel : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full cursor-pointer items-center justify-between rounded-[6px] px-2 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none">
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar className="h-8 w-8 shrink-0 rounded-[6px] bg-primary text-primary-foreground">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName} />
                <AvatarFallback className="bg-primary text-[13px] font-semibold text-primary-foreground">
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
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
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
          <DropdownMenuSeparator />
          {isBusiness && (
            <DropdownMenuItem
              onClick={() => void switchType("personal")}
              className="cursor-pointer"
            >
              <Repeat className="mr-2 h-4 w-4" />
              Switch to Personal finance
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => { window.location.href = `${GATEWAY}/auth/logout`; }} className="text-destructive focus:text-destructive">
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openPanel !== null} onOpenChange={(v) => { if (!v) setOpenPanel(null); }}>
        <DialogContent className="max-w-3xl h-[min(640px,calc(100vh-3rem))] flex flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">
            {ActivePanel && <ActivePanel />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
