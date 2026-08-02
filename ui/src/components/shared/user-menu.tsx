"use client";

import { useState } from "react";
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
import { ProfilePanel } from "@/components/consumer/profile-panel";
import { ModelPanel } from "@/components/consumer/model-panel";
import { SubscriptionPanel } from "@/components/consumer/subscription-panel";
import { SettingsPanel } from "@/components/consumer/settings-panel";
import { TermsPanel } from "@/components/consumer/terms-panel";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type User = {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  userType: string;
};

type PanelKey = "profile" | "model" | "subscription" | "settings" | "terms";

const PANELS: Record<PanelKey, { label: string; panel: React.ComponentType }> = {
  profile: { label: "Profile", panel: ProfilePanel },
  model: { label: "Model", panel: ModelPanel },
  subscription: { label: "Subscription", panel: SubscriptionPanel },
  settings: { label: "Settings", panel: SettingsPanel },
  terms: { label: "Terms & Policies", panel: TermsPanel },
};

export function UserMenu({ user }: { user: User }) {
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);

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
          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent/50 focus:outline-none cursor-pointer">
            <Avatar className="h-7 w-7">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName} />
              <AvatarFallback className="text-xs bg-elevated text-foreground">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setOpenPanel("profile")} className="cursor-pointer">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{user.fullName}</span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {(Object.keys(PANELS) as PanelKey[]).filter((k) => k !== "profile").map((key) => (
            <DropdownMenuItem key={key} onClick={() => setOpenPanel(key)}>
              {PANELS[key].label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { window.location.href = `${GATEWAY}/auth/logout`; }} className="text-destructive focus:text-destructive">
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openPanel !== null} onOpenChange={(v) => { if (!v) setOpenPanel(null); }}>
        <DialogContent>
          {ActivePanel && <ActivePanel />}
        </DialogContent>
      </Dialog>
    </>
  );
}
