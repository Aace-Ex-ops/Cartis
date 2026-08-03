"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Repeat } from "lucide-react";
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
import { SupportPanel } from "@/components/consumer/support-panel";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type User = {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  userType: string;
};

type PanelKey = "profile" | "model" | "subscription" | "settings" | "support" | "terms";

const PANELS: Record<PanelKey, { label: string; panel: React.ComponentType }> = {
  profile: { label: "Profile", panel: ProfilePanel },
  model: { label: "Model", panel: ModelPanel },
  subscription: { label: "Subscription", panel: SubscriptionPanel },
  settings: { label: "Settings", panel: SettingsPanel },
  support: { label: "Support", panel: SupportPanel },
  terms: { label: "Terms & Policies", panel: TermsPanel },
};

export function UserMenu({ user }: { user: User }) {
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const isSeller = pathname?.startsWith("/seller") ?? false;

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
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setOpenPanel("profile")} className="cursor-pointer">
            <div className="flex w-full items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{user.fullName}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {isSeller ? "Seller" : "Consumer"}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {(Object.keys(PANELS) as PanelKey[]).filter((k) => k !== "profile").map((key) => (
            <DropdownMenuItem key={key} onClick={() => setOpenPanel(key)}>
              {PANELS[key].label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push(isSeller ? "/dashboard" : "/seller/dashboard")}>
            <Repeat className="mr-2 h-4 w-4" />
            {isSeller ? "Switch to Consumer" : "Switch to Seller"}
          </DropdownMenuItem>
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
