"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Sparkles } from "lucide-react";
import { MetallicLogo } from "@/components/shared/metallic-logo";

export type NavItem = {
  id: string;
  title: string;
  href: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

export type NavGroup = {
  heading?: string;
  items: NavItem[];
};

export function Sidebar({
  groups,
  upgrade,
  user,
  collapsed = false,
  userType,
}: {
  groups: NavGroup[];
  upgrade?: { title: string; subtitle: string; href: string };
  user?: { id: string; name: string; email: string; avatar: string };
  collapsed?: boolean;
  userType?: string;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-primary/20 bg-background text-foreground font-sans transition-all duration-300 ${
        collapsed ? "w-[72px] items-center p-2.5" : "w-[260px] p-4"
      }`}
    >
      {/* Cartis Brand Header */}
      <Link
        href="/"
        aria-label="Cartis Home"
        className="flex items-center gap-2.5 px-1 pb-4 border-b border-border transition-transform duration-200 hover:scale-[1.02]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-chart-2 font-black text-white text-base shadow-sm">
          C
        </div>
        {!collapsed && (
          <MetallicLogo className="h-6 w-24 text-foreground" />
        )}
      </Link>

      <div className="mt-4 flex flex-1 flex-col gap-5 overflow-y-auto w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group, i) => (
          <div key={i} className="flex flex-col gap-1.5 w-full">
            {group.heading && !collapsed && (
              <span className="mb-1 px-3 text-[10px] font-extrabold uppercase tracking-[0.15em] text-primary">
                {group.heading}
              </span>
            )}
            {group.heading && collapsed && i > 0 && (
              <div className="my-2 h-px w-8 mx-auto bg-border" />
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === pathname;

              if (collapsed) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={item.title}
                    onClick={(e) => {
                      if (item.href.startsWith("http")) {
                        e.preventDefault();
                        window.location.href = item.href;
                      }
                    }}
                    className={`group relative flex h-11 w-11 mx-auto items-center justify-center rounded-2xl transition-all duration-300 ${
                      active
                        ? "bg-gradient-to-tr from-chart-2/40 to-primary/30 text-foreground font-bold shadow-[0_0_20px_rgba(126,193,81,0.3)] scale-105"
                        : "text-muted-foreground hover:bg-gradient-to-tr hover:from-chart-2/20 hover:to-primary/15 hover:text-primary hover:scale-110"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 transition-all duration-300 group-hover:scale-110 ${
                        active
                          ? "text-primary drop-shadow-[0_0_8px_rgba(126,193,81,0.7)]"
                          : "text-muted-foreground group-hover:text-primary"
                      }`}
                      strokeWidth={active ? 2.2 : 1.75}
                    />
                  </Link>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={(e) => {
                    if (item.href.startsWith("http")) {
                      e.preventDefault();
                      window.location.href = item.href;
                    }
                  }}
                  className={`group relative flex items-center gap-3.5 rounded-2xl px-3.5 py-2.5 text-xs font-semibold tracking-wide transition-all duration-300 ${
                    active
                      ? "bg-gradient-to-r from-chart-2/35 via-primary/20 to-chart-5/10 text-foreground font-extrabold border-l-4 border-primary shadow-[0_0_20px_rgba(126,193,81,0.2)] translate-x-1"
                      : "text-muted-foreground hover:bg-gradient-to-r hover:from-chart-2/20 hover:to-transparent hover:text-foreground hover:translate-x-1"
                  }`}
                >
                  <Icon
                    className={`h-4.5 w-4.5 shrink-0 transition-all duration-300 group-hover:scale-110 ${
                      active
                        ? "text-primary drop-shadow-[0_0_8px_rgba(126,193,81,0.7)]"
                        : "text-muted-foreground group-hover:text-primary"
                    }`}
                    strokeWidth={active ? 2.2 : 1.75}
                  />
                  <span className="truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {upgrade && (
        <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3 w-full">
          {collapsed ? (
            <Link
              href={upgrade.href ?? "/dashboard"}
              title={`${upgrade.title}: ${upgrade.subtitle}`}
              className="flex h-11 w-11 mx-auto items-center justify-center rounded-2xl bg-chart-2/30 text-primary transition-all hover:bg-chart-2/50"
            >
              <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </Link>
          ) : (
            <Link
              href={upgrade.href ?? "/dashboard"}
              className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-chart-5/30 via-chart-2/25 to-primary/20 p-3 text-xs tracking-wide text-foreground transition-all hover:shadow-[0_0_20px_rgba(126,193,81,0.25)] hover:scale-[1.02] border border-primary/30"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-primary animate-pulse" strokeWidth={1.5} />
              <span className="flex flex-col leading-tight">
                <span className="font-bold text-foreground">{upgrade.title}</span>
                <span className="text-[10px] text-primary">
                  {upgrade.subtitle}
                </span>
              </span>
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}
