"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function BillsIncomeCard() {
  const items = [
    {
      id: "b1",
      badge: "U",
      badgeBg: "bg-[#b2d959]/40 text-[#132a13] border-[#7ec151]/30",
      dateTag: "today",
      title: "Uber",
      amount: "+₹ 10.00",
      amountColor: "text-[#7ec151]",
    },
    {
      id: "b2",
      badge: "O",
      badgeBg: "bg-[#fed24f]/50 text-[#854d0e] border-[#fed24f]",
      dateTag: "in 5 days",
      title: "Online Course Sale",
      amount: "+₹ 150.00",
      amountColor: "text-[#854d0e]",
    },
    {
      id: "b3",
      badge: "O",
      badgeBg: "bg-[#fed24f]/50 text-[#854d0e] border-[#fed24f]",
      dateTag: "on May 26, 2026",
      title: "Online Course Sale",
      amount: "+₹ 150.00",
      amountColor: "text-[#854d0e]",
    },
    {
      id: "b4",
      badge: "R",
      badgeBg: "bg-[#7ec151]/20 text-[#132a13] border-[#7ec151]/30",
      dateTag: "on Jun 1, 2026",
      title: "Rocket Mortgage",
      amount: "₹ 5,000.00",
      amountColor: "text-[#132a13]",
    },
  ];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <h3 className="text-base font-bold text-[#132a13]">Bills & Income</h3>
        <div className="flex items-center gap-1">
          <button className="rounded-full p-1 text-gray-400 hover:bg-[#b2d959]/20 hover:text-[#7ec151] transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="rounded-full p-1 text-gray-400 hover:bg-[#b2d959]/20 hover:text-[#7ec151] transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2x2 Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col justify-between rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 transition-all duration-300 hover:bg-[#b2d959]/10"
          >
            <div className="flex items-center gap-2">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${item.badgeBg}`}>
                {item.badge}
              </div>
              <span className="text-[11px] font-semibold text-gray-500 truncate">{item.dateTag}</span>
            </div>

            <div className="mt-3">
              <p className="text-xs font-semibold text-[#132a13] truncate">{item.title}</p>
              <p className={`text-sm font-black tabular-nums mt-0.5 ${item.amountColor}`}>
                {item.amount}
              </p>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-4 w-full rounded-xl bg-[#b2d959]/30 hover:bg-[#b2d959]/50 border border-[#7ec151]/30 py-2.5 text-xs font-bold text-[#132a13] transition-all">
        See all Bills & Income
      </button>
    </div>
  );
}
