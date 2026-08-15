"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Sparkles } from "lucide-react";
import { MetallicLogo } from "@/components/shared/metallic-logo";
import { UserMenu } from "@/components/shared/user-menu";

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
  effectivePlan,
}: {
  groups: NavGroup[];
  upgrade?: { title: string; subtitle: string; href: string };
  user?: { id: string; name: string; email: string; avatar: string };
  collapsed?: boolean;
  userType?: string;
  effectivePlan?: string;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-[#7ec151]/20 bg-white text-[#132a13] font-sans transition-all duration-300 ${
        collapsed ? "w-[72px] items-center p-2.5" : "w-[260px] p-4"
      }`}
    >
      {/* Cartis Brand Header */}
      <Link
        href="/"
        aria-label="Cartis Home"
        className="flex items-center gap-2.5 px-1 pb-4 border-b border-gray-100 transition-transform duration-200 hover:scale-[1.02]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#7ec151] to-[#b2d959] font-black text-white text-base shadow-sm">
          C
        </div>
        {!collapsed && (
          <MetallicLogo className="h-6 w-24 text-[#132a13]" />
        )}
      </Link>

      <div className="mt-4 flex flex-1 flex-col gap-5 overflow-y-auto w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group, i) => (
          <div key={i} className="flex flex-col gap-1.5 w-full">
            {group.heading && !collapsed && (
              <span className="mb-1 px-3 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#7ec151]">
                {group.heading}
              </span>
            )}
            {group.heading && collapsed && i > 0 && (
              <div className="my-2 h-px w-8 mx-auto bg-gray-200" />
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
                        ? "bg-gradient-to-tr from-[#b2d959]/40 to-[#7ec151]/30 text-[#132a13] font-bold shadow-[0_0_20px_rgba(126,193,81,0.3)] scale-105"
                        : "text-gray-500 hover:bg-gradient-to-tr hover:from-[#b2d959]/20 hover:to-[#7ec151]/15 hover:text-[#7ec151] hover:scale-110"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 transition-all duration-300 group-hover:scale-110 ${
                        active
                          ? "text-[#7ec151] drop-shadow-[0_0_8px_rgba(126,193,81,0.7)]"
                          : "text-gray-400 group-hover:text-[#7ec151]"
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
                      ? "bg-gradient-to-r from-[#b2d959]/35 via-[#7ec151]/20 to-[#fed24f]/10 text-[#132a13] font-extrabold border-l-4 border-[#7ec151] shadow-[0_0_20px_rgba(126,193,81,0.2)] translate-x-1"
                      : "text-gray-600 hover:bg-gradient-to-r hover:from-[#b2d959]/20 hover:to-transparent hover:text-[#132a13] hover:translate-x-1"
                  }`}
                >
                  <Icon
                    className={`h-4.5 w-4.5 shrink-0 transition-all duration-300 group-hover:scale-110 ${
                      active
                        ? "text-[#7ec151] drop-shadow-[0_0_8px_rgba(126,193,81,0.7)]"
                        : "text-gray-400 group-hover:text-[#7ec151]"
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

      {user && (
        <div className={`w-full ${collapsed ? "mb-1" : "mb-2"}`}>
          <UserMenu
            user={{ fullName: user.name, email: user.email, avatarUrl: user.avatar, userType: userType ?? "" }}
            effectivePlan={effectivePlan}
            userType={userType}
            collapsed={collapsed}
          />
        </div>
      )}

      {upgrade && (
        <div className="mt-auto flex flex-col gap-1 border-t border-gray-100 pt-3 w-full">
          {collapsed ? (
            <Link
              href={upgrade.href ?? "/dashboard"}
              title={`${upgrade.title}: ${upgrade.subtitle}`}
              className="flex h-11 w-11 mx-auto items-center justify-center rounded-2xl bg-[#b2d959]/30 text-[#7ec151] transition-all hover:bg-[#b2d959]/50"
            >
              <Sparkles className="h-5 w-5 text-[#7ec151]" strokeWidth={1.5} />
            </Link>
          ) : (
            <Link
              href={upgrade.href ?? "/dashboard"}
              className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#fed24f]/30 via-[#b2d959]/25 to-[#7ec151]/20 p-3 text-xs tracking-wide text-[#132a13] transition-all hover:shadow-[0_0_20px_rgba(126,193,81,0.25)] hover:scale-[1.02] border border-[#7ec151]/30"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-[#7ec151] animate-pulse" strokeWidth={1.5} />
              <span className="flex flex-col leading-tight">
                <span className="font-bold text-[#132a13]">{upgrade.title}</span>
                <span className="text-[10px] text-[#7ec151]">
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
