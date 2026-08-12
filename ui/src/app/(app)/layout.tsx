"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  History,
  PieChart,
  ShoppingCart,
  Wallet,
  Target,
  Briefcase,
  Calculator,
  TrendingUp,
  ReceiptText,
  FileText,
  Waves,
  Package,
  Sparkles,
} from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { gql } from "@/lib/gql";

const PERSONAL_NAV = [
  {
    items: [
      { id: "nav-home", title: "Home", href: "/dashboard", icon: LayoutDashboard },
      { id: "nav-wallet", title: "Wallet", href: "/dashboard/wallet", icon: Wallet },
      { id: "nav-analysis", title: "Analysis History", href: "/dashboard/analysis", icon: History },
      { id: "nav-budget", title: "Budget & Spending", href: "/dashboard/budget", icon: PieChart },
      { id: "nav-purchases", title: "Purchase Tracker", href: "/dashboard/purchases", icon: ShoppingCart },
      { id: "nav-goals", title: "Goals", href: "/dashboard/goals", icon: Target },
      { id: "nav-portfolio", title: "Portfolio", href: "/dashboard/portfolio", icon: Briefcase },
      { id: "nav-tools", title: "Tools", href: "/dashboard/tools", icon: Calculator },
    ],
  },
];

const BUSINESS_NAV = [
  {
    items: [
      { id: "nav-home", title: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { id: "nav-income", title: "Income", href: "/dashboard/income", icon: TrendingUp },
      { id: "nav-expenses", title: "Expenses", href: "/dashboard/expenses", icon: ReceiptText },
      { id: "nav-pnl", title: "Profit & Loss", href: "/dashboard/pnl", icon: FileText },
      { id: "nav-tax", title: "GST & Tax", href: "/dashboard/tax", icon: Calculator },
      { id: "nav-cashflow", title: "Cash Flow", href: "/dashboard/cashflow", icon: Waves },
      { id: "nav-inventory", title: "Inventory", href: "/dashboard/inventory", icon: Package },
      { id: "nav-coach", title: "Financial Advisor", href: "/dashboard/coach", icon: Sparkles },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [userType, setUserType] = useState<string | null>(null);
  const [effectivePlan, setEffectivePlan] = useState<string>("free");

  useEffect(() => {
    let cancelled = false;
    void gql<{ me?: { userType?: string; effectivePlan?: string } | null }>(
      "{ me { userType effectivePlan } }"
    )
      .then((d) => {
        if (!cancelled) {
          setUserType(d.me?.userType ?? "personal");
          setEffectivePlan(d.me?.effectivePlan ?? "free");
        }
      })
      .catch(() => {
        if (!cancelled) setUserType("personal");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isBusiness = userType === "business" || userType === "seller";
  const isEnterprise = effectivePlan === "enterprise";
  const groups = isEnterprise
    ? [...PERSONAL_NAV, ...BUSINESS_NAV]
    : isBusiness
      ? BUSINESS_NAV
      : PERSONAL_NAV;

  return (
    <DashboardShell
      groups={groups}
      userType={userType ?? "personal"}
      upgrade={
        isBusiness && !isEnterprise
          ? { title: effectivePlan === "trial" ? "Trial" : "Business", subtitle: "Team plan", href: "/dashboard" }
          : undefined
      }
    >
      {children}
    </DashboardShell>
  );
}
