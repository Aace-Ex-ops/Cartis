"use client";

import {
  LayoutDashboard,
  History,
  PieChart,
  ShoppingCart,
  Wallet,
  Bot,
} from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";

const CONSUMER_NAV = [
  {
    items: [
      { id: "nav-home", title: "Home", href: "/dashboard", icon: LayoutDashboard },
      { id: "nav-wallet", title: "Wallet", href: "/dashboard/wallet", icon: Wallet },
      { id: "nav-twin", title: "AI Twin", href: "/dashboard/twin", icon: Bot },
      { id: "nav-analysis", title: "Analysis History", href: "/dashboard/analysis", icon: History },
      { id: "nav-budget", title: "Budget & Spending", href: "/dashboard/budget", icon: PieChart },
      { id: "nav-purchases", title: "Purchase Tracker", href: "/dashboard/purchases", icon: ShoppingCart },
    ],
  },
];

export default function ConsumerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      groups={CONSUMER_NAV}
    >
      {children}
    </DashboardShell>
  );
}
