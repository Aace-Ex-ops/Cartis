"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import LineSidebar from "@/components/shared/line-sidebar";
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

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2 py-3 select-none">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        C
      </div>
      <span className="text-[15px] font-semibold tracking-wide text-foreground">
        <MetallicLogo className="h-[18px] w-[58px]" />
      </span>
    </Link>
  );
}

export function Sidebar({
  groups,
  upgrade,
  user,
}: {
  groups: NavGroup[];
  upgrade?: { title: string; subtitle: string; href: string };
  user?: { name: string; email: string };
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-border/50 bg-card/50 p-3">
      <Logo />

      <div className="mt-2 flex flex-1 flex-col gap-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group, i) => {
          const activeIndex = group.items.findIndex((item) => item.href === pathname);
          return (
            <div key={i} className="flex flex-col">
              {group.heading && (
                <span className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  {group.heading}
                </span>
              )}
              <LineSidebar
                key={`${group.heading ?? i}-${pathname}`}
                items={group.items.map((item) => item.title)}
                accentColor="#10b981"
                textColor="#a1a1aa"
                markerColor="#52525b"
                defaultActive={activeIndex >= 0 ? activeIndex : null}
                proximityRadius={80}
                maxShift={16}
                markerLength={40}
                tickScale={0.5}
                itemGap={6}
                fontSize={0.8}
                smoothing={90}
                onItemClick={(index) => {
                  const href = group.items[index].href;
                  if (href.startsWith("http")) {
                    window.location.href = href;
                  } else {
                    router.push(href);
                  }
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-border/50 pt-4">
        {upgrade && (
          <Link
            href={upgrade.href ?? "/dashboard"}
            className="flex items-center gap-2.5 rounded-md border border-primary/25 bg-primary/10 px-2.5 py-2 text-[13px] text-primary transition-colors hover:bg-primary/15"
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.5} />
            <span className="flex flex-col leading-tight">
              <span className="font-medium">{upgrade.title}</span>
              <span className="text-[11px] text-muted-foreground">
                {upgrade.subtitle}
              </span>
            </span>
          </Link>
        )}
        {user && (
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-[12px] font-semibold text-foreground">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[13px] font-medium text-foreground">
                {user.name}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {user.email}
              </span>
            </div>
            <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          </div>
        )}
      </div>
    </aside>
  );
}
