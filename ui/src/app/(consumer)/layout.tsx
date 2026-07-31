"use client";

import {
  LayoutDashboard,
  History,
  PieChart,
  ShoppingCart,
  Landmark,
  Settings,
} from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";

const CONSUMER_NAV = [
  {
    items: [
      { id: "home", title: "Home", href: "/dashboard", icon: LayoutDashboard },
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
  return (
    <DashboardShell
      groups={CONSUMER_NAV}
      upgrade={{ title: "Upgrade", subtitle: "12 credits left", href: "/dashboard" }}
    >
      {children}
    </DashboardShell>
  );
}
