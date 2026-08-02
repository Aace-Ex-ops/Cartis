"use client";

import {
  LayoutDashboard,
  History,
  PieChart,
  ShoppingCart,
  Settings,
  Wallet,
  Bot,
  User,
  Cpu,
  CreditCard,
  FileText,
  LogOut,
} from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

const CONSUMER_NAV = [
  {
    items: [
      { id: "home", title: "Home", href: "/dashboard", icon: LayoutDashboard },
      { id: "wallet", title: "Wallet", href: "/dashboard/wallet", icon: Wallet },
      { id: "twin", title: "AI Twin", href: "/dashboard/twin", icon: Bot },
      { id: "analysis", title: "Analysis History", href: "/dashboard/analysis", icon: History },
      { id: "budget", title: "Budget & Spending", href: "/dashboard/budget", icon: PieChart },
      { id: "purchases", title: "Purchase Tracker", href: "/dashboard/purchases", icon: ShoppingCart },
      { id: "settings", title: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
  {
    heading: "Profile",
    items: [
      { id: "profile", title: "Profile", href: "/dashboard/profile", icon: User },
      { id: "model", title: "Model", href: "/dashboard/model", icon: Cpu },
      { id: "subscription", title: "Subscription", href: "/dashboard/subscription", icon: CreditCard },
      { id: "profile-settings", title: "Settings", href: "/dashboard/settings", icon: Settings },
      { id: "terms", title: "Terms & Policies", href: "/dashboard/terms", icon: FileText },
      { id: "signout", title: "Sign out", href: `${GATEWAY}/auth/logout`, icon: LogOut },
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
