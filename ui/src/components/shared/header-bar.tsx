"use client";

import { useEffect, useState } from "react";
import { Bell, HelpCircle, Settings, Search, Bot } from "lucide-react";
import { useRouter } from "next/navigation";
import { TwinDrawer } from "@/components/shared/twin-drawer";
import { UserMenu } from "@/components/shared/user-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsPanel } from "@/components/consumer/settings-panel";
import { SupportPanel } from "@/components/consumer/support-panel";

const OPEN_TWIN_EVENT = "cartis:open-twin";

export function HeaderBar({
  alerts = [],
  leading,
  user,
  effectivePlan,
  userType,
}: {
  alerts?: { id: string; title: string; time: string }[];
  leading?: React.ReactNode;
  user?: { id: string; name: string; email: string; avatar: string };
  effectivePlan?: string;
  userType?: string;
}) {
  const [twinOpen, setTwinOpen] = useState(false);
  const [panel, setPanel] = useState<"settings" | "support" | "alerts" | null>(null);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const openTwin = () => setTwinOpen(true);
    window.addEventListener(OPEN_TWIN_EVENT, openTwin);
    return () => window.removeEventListener(OPEN_TWIN_EVENT, openTwin);
  }, []);

  const submitSearch = () => {
    if (!query.trim()) return;
    router.push(`/dashboard/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-primary/20 bg-background px-6 text-foreground shadow-sm">
      <div className="flex items-center gap-3">
        {leading}
        <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard</h1>
      </div>

      <div className="relative mx-6 min-w-0 flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitSearch()}
          placeholder="Search transactions, purchases…"
          className="w-full rounded-full border border-primary/30 bg-background py-2 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setTwinOpen(true)}
          className="group relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-primary via-chart-2 to-chart-5 text-white shadow-[0_0_15px_rgba(126,193,81,0.4)] transition-all duration-300 hover:scale-110 active:scale-95"
          title="AI Twin Chat"
        >
          <Bot className="h-5 w-5 text-white transition-transform duration-300 group-hover:rotate-12" strokeWidth={2} />
          <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-chart-5 ring-2 ring-background animate-pulse" />
        </button>

        <button
          onClick={() => setPanel("alerts")}
          className="rounded-full p-2 text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors"
          title="Notifications"
        >
          <Bell className="h-4.5 w-4.5" strokeWidth={1.75} />
        </button>

        <button
          onClick={() => setPanel("support")}
          className="rounded-full p-2 text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors"
          title="Help & Support"
        >
          <HelpCircle className="h-4.5 w-4.5" strokeWidth={1.75} />
        </button>

        <button
          onClick={() => setPanel("settings")}
          className="rounded-full p-2 text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors"
          title="Settings"
        >
          <Settings className="h-4.5 w-4.5" strokeWidth={1.75} />
        </button>

        {user && (
          <UserMenu
            user={{ fullName: user.name, email: user.email, avatarUrl: user.avatar, userType: userType ?? "" }}
            effectivePlan={effectivePlan}
            userType={userType}
            collapsed
          />
        )}
      </div>

      <TwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />

      <Dialog open={panel !== null} onOpenChange={(v) => { if (!v) setPanel(null); }}>
        <DialogContent className="max-w-3xl h-[min(640px,calc(100vh-3rem))] flex flex-col overflow-hidden">
          <DialogTitle className="sr-only">
            {panel === "settings" ? "Settings" : panel === "support" ? "Help & Support" : "Notifications"}
          </DialogTitle>
          <div className="flex min-h-0 flex-1 flex-col">
            {panel === "settings" && <SettingsPanel />}
            {panel === "support" && <SupportPanel />}
            {panel === "alerts" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Notifications</h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {alerts.length === 0 ? "No new alerts right now." : `${alerts.length} active alert${alerts.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="flex flex-col divide-y divide-border/30">
                  {alerts.length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-muted-foreground">All caught up.</p>
                  ) : (
                    alerts.map((a) => (
                      <div key={a.id} className="flex flex-col gap-0.5 py-3">
                        <span className="text-[13px] font-medium text-foreground">{a.title}</span>
                        <span className="text-[11px] text-muted-foreground">{a.time}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
