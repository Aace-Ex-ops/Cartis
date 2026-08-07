"use client";

import {
  LayoutDashboard,
  TrendingUp,
  ReceiptText,
  FileText,
  Calculator,
  Waves,
  Package,
  Sparkles,
} from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";

const SELLER_NAV = [
  {
    heading: "Business",
    items: [
      { id: "dashboard", title: "Overview", href: "/seller/dashboard", icon: LayoutDashboard },
      { id: "income", title: "Income", href: "/seller/income", icon: TrendingUp },
      { id: "expenses", title: "Expenses", href: "/seller/expenses", icon: ReceiptText },
      { id: "pnl", title: "Profit & Loss", href: "/seller/pnl", icon: FileText },
      { id: "tax", title: "GST & Tax", href: "/seller/tax", icon: Calculator },
      { id: "cashflow", title: "Cash Flow", href: "/seller/cashflow", icon: Waves },
      { id: "inventory", title: "Inventory", href: "/seller/inventory", icon: Package },
      { id: "coach", title: "Financial Advisor", href: "/seller/coach", icon: Sparkles },
    ],
  },
];

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      groups={SELLER_NAV}
      upgrade={{ title: "Business", subtitle: "SMB plan", href: "/seller/dashboard" }}
    >
      {children}
    </DashboardShell>
  );
}
