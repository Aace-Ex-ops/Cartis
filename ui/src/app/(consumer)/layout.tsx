"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  History,
  PieChart,
  ShoppingCart,
  Landmark,
  Settings,
  Wallet,
  Bot,
} from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { gql } from "@/lib/gql";

const CONSUMER_NAV = [
  {
    items: [
      { id: "home", title: "Home", href: "/dashboard", icon: LayoutDashboard },
      { id: "wallet", title: "Wallet", href: "/dashboard/wallet", icon: Wallet },
      { id: "twin", title: "AI Twin", href: "/dashboard/twin", icon: Bot },
      { id: "analysis", title: "Analysis History", href: "/dashboard/analysis", icon: History },
      { id: "budget", title: "Budget & Spending", href: "/dashboard/budget", icon: PieChart },
      { id: "purchases", title: "Purchase Tracker", href: "/dashboard/purchases", icon: ShoppingCart },
      { id: "bank", title: "Bank Account", href: "/dashboard/bank", icon: Landmark },
      { id: "settings", title: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

export default function ConsumerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [bankBalance, setBankBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void gql<{ bankAccounts: { balance: number | null }[] }>(
      "{ bankAccounts { balance } }",
    )
      .then((d) => {
        if (!cancelled) setBankBalance(d.bankAccounts[0]?.balance ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardShell
      groups={CONSUMER_NAV}
      upgrade={
        bankBalance !== null
          ? {
              title: "Wallet",
              subtitle: `₹${bankBalance.toLocaleString("en-IN")} bank balance`,
              href: "/dashboard/wallet",
            }
          : undefined
      }
    >
      {children}
    </DashboardShell>
  );
}
