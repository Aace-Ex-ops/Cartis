"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, MoreVertical } from "lucide-react";

type AccountItem = {
  id: string;
  name: string;
  amount: number;
  tooltip?: string;
  subItems?: AccountItem[];
};

type CategoryGroup = {
  id: string;
  title: string;
  total: number;
  items: AccountItem[];
};

const fmt = (n: number) => {
  const isNeg = n < 0;
  const abs = Math.abs(n);
  return `${isNeg ? "-" : ""}₹${abs.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
};

export type BankAccount = {
  accountId: string;
  bankName: string;
  accountType: string | null;
  maskedAccountNumber: string | null;
  accountName: string | null;
  balance: number | null;
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  SAVINGS: "Savings",
  CHECKING: "Checking",
  CREDIT: "Credit card",
  CHARGE: "Charge card",
  CD: "Fixed deposit",
  BROKERAGE_CASH: "Brokerage",
  EMPLOYEE_RETIREMENT_ACCOUNT_401K: "401(k)",
  INDIVIDUAL_RETIREMENT_ACCOUNT_IRA: "Retirement (IRA)",
  REWARD_POINTS: "Reward points",
  LIFE_INSURANCE: "Life insurance",
  INSURANCE: "Insurance",
  OTHER: "Other",
};

export const accountLabel = (a: Pick<BankAccount, "accountType" | "maskedAccountNumber">) => {
  const type =
    (a.accountType && ACCOUNT_TYPE_LABELS[a.accountType]) ??
    (a.accountType
      ? a.accountType.charAt(0) + a.accountType.slice(1).toLowerCase().replace(/_/g, " ")
      : "Account");
  return a.maskedAccountNumber ? `${type} ••${a.maskedAccountNumber.replace(/[^0-9]/g, "").slice(-4)}` : type;
};

export type Holding = {
  holdingId: string;
  assetType: string;
  name: string;
  quantity: number | null;
  currentPrice: number | null;
};

function buildGroups(accounts: BankAccount[], holdings: Holding[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  if (accounts.length > 0) {
    groups.push({
      id: "banking",
      title: "Banking",
      total: accounts.reduce((s, a) => s + (a.balance ?? 0), 0),
      items: accounts.map((a) => ({
        id: `bank-${a.accountId}`,
        name: a.accountName?.trim() || accountLabel(a),
        tooltip: a.bankName,
        amount: a.balance ?? 0,
      })),
    });
  }
  if (holdings.length > 0) {
    groups.push({
      id: "investments",
      title: "Investments",
      total: holdings.reduce((s, h) => s + (h.quantity ?? 0) * (h.currentPrice ?? 0), 0),
      items: holdings.map((h) => ({
        id: `holding-${h.holdingId}`,
        name: h.name,
        amount: (h.quantity ?? 0) * (h.currentPrice ?? 0),
      })),
    });
  }
  return groups;
}

export function AccountsTree({ accounts, holdings, totalNetWorth }: { accounts: BankAccount[]; holdings: Holding[]; totalNetWorth: number }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const groups = buildGroups(accounts, holdings);

  const toggle = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-5 shadow-sm transition-all duration-300">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <h2 className="text-xl font-bold text-foreground tracking-tight">Accounts</h2>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-chart-2 hover:from-chart-2 hover:to-chart-3 px-3 py-1 text-xs font-bold text-white shadow-sm transition-all">
            <Plus className="h-3.5 w-3.5" />
            <span>New</span>
          </button>
          <button className="rounded-full p-1 text-muted-foreground hover:bg-chart-2/20 hover:text-primary transition-colors">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Top All Accounts Summary */}
      <div className="flex items-center justify-between py-3.5 border-b border-border">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">All Accounts</span>
        <span className="text-base font-bold tabular-nums text-foreground">{fmt(totalNetWorth)}</span>
      </div>

      {/* Accounts Collapsible Tree */}
      <div className="mt-2 flex flex-col gap-1 overflow-y-auto max-h-[640px] pr-1 [scrollbar-width:none]">
        {groups.map((group) => {
          const isGroupOpen = !!openGroups[group.id];
          return (
            <div key={group.id} className="flex flex-col">
              {/* Category Header Row */}
              <button
                onClick={() => toggle(group.id)}
                className="flex items-center justify-between py-2 px-1 rounded-lg hover:bg-chart-2/15 transition-colors text-left"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isGroupOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                  <span className="text-xs font-bold text-foreground truncate">{group.title}</span>
                </div>
                <span className="text-xs font-bold tabular-nums text-foreground">{fmt(group.total)}</span>
              </button>

              {/* Sub-items Level 1 */}
              {isGroupOpen && (
                <div className="ml-3 flex flex-col gap-1 border-l border-primary/20 pl-2">
                  {group.items.map((sub) => {
                    const isSubOpen = !!openGroups[sub.id];
                    return (
                      <div key={sub.id} className="flex flex-col">
                        <button
                          onClick={() => toggle(sub.id)}
                          className="flex items-center justify-between py-1.5 px-1 rounded-lg hover:bg-chart-2/15 transition-colors text-left"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {sub.subItems && (
                              isSubOpen ? (
                                <ChevronDown className="h-3 w-3 text-chart-2 shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-chart-2 shrink-0" />
                              )
                            )}
                            <span className="text-xs font-semibold text-foreground truncate" title={sub.tooltip ?? sub.name}>{sub.name}</span>
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-foreground">{fmt(sub.amount)}</span>
                        </button>

                        {/* Leaf Sub-items Level 2 */}
                        {isSubOpen && sub.subItems && (
                          <div className="ml-3 flex flex-col gap-1 pl-2 my-0.5">
                            {sub.subItems.map((leaf) => (
                              <div
                                key={leaf.id}
                                className="flex items-center justify-between py-1 px-1 rounded hover:bg-chart-2/10 text-xs text-muted-foreground"
                              >
                                <span className="truncate">{leaf.name}</span>
                                <span className="tabular-nums font-medium text-foreground">{fmt(leaf.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
