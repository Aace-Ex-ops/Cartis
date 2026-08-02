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
      { id: "home", title: "Home", href: "/dashboard", icon: LayoutDashboard },
      { id: "wallet", title: "Wallet", href: "/dashboard/wallet", icon: Wallet },
      { id: "twin", title: "AI Twin", href: "/dashboard/twin", icon: Bot },
      { id: "analysis", title: "Analysis History", href: "/dashboard/analysis", icon: History },
      { id: "budget", title: "Budget & Spending", href: "/dashboard/budget", icon: PieChart },
      { id: "purchases", title: "Purchase Tracker", href: "/dashboard/purchases", icon: ShoppingCart },
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
