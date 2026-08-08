"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar, type NavGroup } from "@/components/shared/sidebar";
import { HeaderBar } from "@/components/shared/header-bar";
import { getMe, type User } from "@/lib/auth";

export function DashboardShell({
  groups,
  upgrade,
  children,
}: {
  groups: NavGroup[];
  upgrade?: { title: string; subtitle: string; href: string };
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMe().then((me) => {
      if (cancelled) return;
      if (!me) {
        window.location.href = "/";
        return;
      }
      setUser(me);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div
        className={`shrink-0 overflow-hidden transition-all duration-300 ${
          collapsed ? "w-0 opacity-0" : "w-[240px] opacity-100"
        }`}
      >
        {user && <Sidebar groups={groups} upgrade={upgrade} user={user} />}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar
          user={user ?? undefined}
          leading={
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />
              ) : (
                <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.5} />
              )}
            </button>
          }
        />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
