"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, MoreVertical } from "lucide-react";

type AccountItem = {
  id: string;
  name: string;
  amount: number;
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

const INITIAL_GROUPS: CategoryGroup[] = [
  {
    id: "banking",
    title: "Banking",
    total: 3947.5,
    items: [
      {
        id: "savings-parent",
        name: "Savings",
        amount: 3947.5,
        subItems: [
          { id: "s1", name: "Sam Lee Savings", amount: 3947.5 },
          { id: "s2", name: "Savings Goals", amount: 1980.0 },
          { id: "s3", name: "Available Balance", amount: 1967.5 },
        ],
      },
    ],
  },
  {
    id: "investments",
    title: "Investments",
    total: 48620.05,
    items: [
      {
        id: "brokerage-parent",
        name: "Brokerage",
        amount: 48620.05,
        subItems: [{ id: "inv1", name: "Sam Lee Stock Portfolio", amount: 48620.05 }],
      },
    ],
  },
  {
    id: "assets",
    title: "Assets",
    total: 1500000.0,
    items: [
      {
        id: "realestate-parent",
        name: "Real Estate",
        amount: 1500000.0,
        subItems: [{ id: "asset1", name: "1226 University Dr, Menlo Park, C...", amount: 1500000.0 }],
      },
    ],
  },
  {
    id: "liabilities",
    title: "Liabilities",
    total: -1455000.0,
    items: [
      {
        id: "home-loan-parent",
        name: "Home Loan",
        amount: -1455000.0,
        subItems: [{ id: "lia1", name: "Home Loan", amount: -1455000.0 }],
      },
    ],
  },
];

export function AccountsTree({ totalNetWorth }: { totalNetWorth: number }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    banking: true,
    investments: true,
    assets: true,
    liabilities: true,
    "savings-parent": true,
    "brokerage-parent": true,
    "realestate-parent": true,
    "home-loan-parent": true,
  });

  const toggle = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#7ec151]/20 bg-white p-5 shadow-sm transition-all duration-300">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <h2 className="text-xl font-bold text-[#132a13] tracking-tight">Accounts</h2>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#7ec151] to-[#b2d959] hover:from-[#6cae42] hover:to-[#9fc44a] px-3 py-1 text-xs font-bold text-white shadow-sm transition-all">
            <Plus className="h-3.5 w-3.5" />
            <span>New</span>
          </button>
          <button className="rounded-full p-1 text-gray-400 hover:bg-[#b2d959]/20 hover:text-[#7ec151] transition-colors">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Top All Accounts Summary */}
      <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
        <span className="text-xs font-bold text-[#132a13] uppercase tracking-wider">All Accounts</span>
        <span className="text-base font-bold tabular-nums text-[#132a13]">{fmt(totalNetWorth)}</span>
      </div>

      {/* Accounts Collapsible Tree */}
      <div className="mt-2 flex flex-col gap-1 overflow-y-auto max-h-[640px] pr-1 [scrollbar-width:none]">
        {INITIAL_GROUPS.map((group) => {
          const isGroupOpen = !!openGroups[group.id];
          return (
            <div key={group.id} className="flex flex-col">
              {/* Category Header Row */}
              <button
                onClick={() => toggle(group.id)}
                className="flex items-center justify-between py-2 px-1 rounded-lg hover:bg-[#b2d959]/15 transition-colors text-left"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isGroupOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-[#7ec151] shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-[#7ec151] shrink-0" />
                  )}
                  <span className="text-xs font-bold text-[#132a13] truncate">{group.title}</span>
                </div>
                <span className="text-xs font-bold tabular-nums text-[#132a13]">{fmt(group.total)}</span>
              </button>

              {/* Sub-items Level 1 */}
              {isGroupOpen && (
                <div className="ml-3 flex flex-col gap-1 border-l border-[#7ec151]/20 pl-2">
                  {group.items.map((sub) => {
                    const isSubOpen = !!openGroups[sub.id];
                    return (
                      <div key={sub.id} className="flex flex-col">
                        <button
                          onClick={() => toggle(sub.id)}
                          className="flex items-center justify-between py-1.5 px-1 rounded-lg hover:bg-[#b2d959]/15 transition-colors text-left"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {sub.subItems && (
                              isSubOpen ? (
                                <ChevronDown className="h-3 w-3 text-[#b2d959] shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-[#b2d959] shrink-0" />
                              )
                            )}
                            <span className="text-xs font-semibold text-gray-800 truncate">{sub.name}</span>
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-gray-800">{fmt(sub.amount)}</span>
                        </button>

                        {/* Leaf Sub-items Level 2 */}
                        {isSubOpen && sub.subItems && (
                          <div className="ml-3 flex flex-col gap-1 pl-2 my-0.5">
                            {sub.subItems.map((leaf) => (
                              <div
                                key={leaf.id}
                                className="flex items-center justify-between py-1 px-1 rounded hover:bg-[#b2d959]/10 text-xs text-gray-600"
                              >
                                <span className="truncate">{leaf.name}</span>
                                <span className="tabular-nums font-medium text-gray-700">{fmt(leaf.amount)}</span>
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
