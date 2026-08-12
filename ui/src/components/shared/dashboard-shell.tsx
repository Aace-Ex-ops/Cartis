"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar, type NavGroup } from "@/components/shared/sidebar";
import { HeaderBar } from "@/components/shared/header-bar";
import { getMe, type User } from "@/lib/auth";

const DEMO_USER: User = {
  id: "demo-user",
  email: "preview@cartis.ai",
  name: "Aditya Sharma",
  avatar: "",
};

const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

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
    // Ensure clean light background matching Color Hunt #FDFEF7 palette
    document.documentElement.classList.remove("dark");
    document.documentElement.style.removeProperty("overflow");
    document.body.style.removeProperty("overflow");
    document.body.style.overflow = "auto";

    let cancelled = false;
    void getMe().then((me) => {
      if (cancelled) return;
      if (!me) {
        if (isDemo) {
          setUser(DEMO_USER);
          return;
        }
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
    <div className="relative flex min-h-screen w-full bg-[#fdfef7] text-[#132a13] font-sans">
      {/* Sticky Sidebar Rail */}
      <aside
        className={`sticky top-0 h-screen shrink-0 transition-all duration-300 ease-in-out z-20 ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        {user && (
          <Sidebar
            groups={groups}
            upgrade={upgrade}
            user={user}
            collapsed={collapsed}
          />
        )}
      </aside>

      {/* Main Content Column */}
      <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
        <HeaderBar
          leading={
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-[#b2d959]/20 hover:text-[#7ec151]"
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
        <main className="w-full flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
