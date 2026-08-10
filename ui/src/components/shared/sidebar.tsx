"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Sparkles } from "lucide-react";
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
}: {
  groups: NavGroup[];
  upgrade?: { title: string; subtitle: string; href: string };
  user?: { id: string; name: string; email: string; avatar: string };
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-border/50 bg-card/50 p-3 font-sans">
      {user && (
        <div className="px-0.5 pb-1">
          <UserMenu
            user={{ fullName: user.name, email: user.email, avatarUrl: user.avatar, userType: "" }}
          />
        </div>
      )}

      <div className="mt-1 flex flex-1 flex-col gap-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {group.heading && (
              <span className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                {group.heading}
              </span>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === pathname;
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
                  className={`group flex items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-[13px] tracking-wide transition-colors ${
                    active
                      ? "bg-black/5 font-medium text-foreground dark:bg-white/10"
                      : "text-muted-foreground hover:bg-black/5 hover:text-foreground/90 dark:hover:bg-white/5"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active
                        ? "text-foreground"
                        : "text-muted-foreground/70 group-hover:text-foreground/70"
                    }`}
                    strokeWidth={1.5}
                  />
                  <span className="truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {upgrade && (
        <div className="mt-auto flex flex-col gap-0.5 border-t border-border/50 pt-3">
          <Link
            href={upgrade.href ?? "/dashboard"}
            className="group flex items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-[13px] tracking-wide text-primary transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground/70 group-hover:text-foreground/70" strokeWidth={1.5} />
            <span className="flex flex-col leading-tight">
              <span className="font-medium">{upgrade.title}</span>
              <span className="text-[11px] text-muted-foreground">
                {upgrade.subtitle}
              </span>
            </span>
          </Link>
        </div>
      )}
    </aside>
  );
}
