"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, HelpCircle, Settings, Bot, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { TwinDrawer } from "@/components/shared/twin-drawer";

export function HeaderBar({
  alerts = [],
  leading,
}: {
  alerts?: { id: string; title: string; time: string }[];
  leading?: React.ReactNode;
}) {
  const [twinOpen, setTwinOpen] = useState(false);
  const [isRobotHovered, setIsRobotHovered] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const submitSearch = () => {
    if (!query.trim()) return;
    router.push(`/dashboard/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#7ec151]/20 bg-white px-6 text-[#132a13] shadow-sm">
      <div className="flex items-center gap-3">
        {leading}
        <h1 className="text-xl font-bold text-[#132a13] tracking-tight">Dashboard</h1>
      </div>

      <div className="relative mx-6 min-w-0 flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7ec151]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitSearch()}
          placeholder="Search transactions, purchases…"
          className="w-full rounded-full border border-[#7ec151]/30 bg-white py-2 pl-9 pr-3 text-[13px] text-[#132a13] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7ec151]/40"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Robot Face AI Twin Icon with Left Hover "Hi!" Speech Bubble */}
        <div
          className="relative inline-flex items-center justify-center"
          onMouseEnter={() => setIsRobotHovered(true)}
          onMouseLeave={() => setIsRobotHovered(false)}
        >
          {/* Animated Dialogue Speech Bubble */}
          <AnimatePresence>
            {isRobotHovered && (
              <motion.div
                initial={{ opacity: 0, x: 8, scale: 0.85 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 6, scale: 0.85 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 z-30 pointer-events-none"
              >
                <div className="relative rounded-full bg-[#132a13] px-3 py-1 text-[11px] font-extrabold text-white shadow-xl flex items-center gap-1 border border-[#fed24f]/50 whitespace-nowrap">
                  <span>Hi!</span>
                  <span className="animate-bounce">👋</span>
                  {/* Arrow Pointing Right */}
                  <div className="absolute -right-1 top-1/2 -translate-y-1/2 h-2 w-2 rotate-45 bg-[#132a13] border-t border-r border-[#fed24f]/50" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Robot Face Button */}
          <button
            onClick={() => setTwinOpen(true)}
            className="group relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#7ec151] via-[#b2d959] to-[#fed24f] text-white shadow-[0_0_15px_rgba(126,193,81,0.4)] transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(126,193,81,0.6)] active:scale-95"
            title="AI Twin Chat"
          >
            {/* Robot Face Icon */}
            <Bot className="h-5 w-5 text-white transition-transform duration-300 group-hover:rotate-12" strokeWidth={2} />

            {/* Glowing Active Status LED Dot (Lemon Sunshine #FFF449) */}
            <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-[#fff449] ring-2 ring-white animate-pulse" />
          </button>
        </div>

        <button
          className="rounded-full p-2 text-gray-500 hover:bg-[#b2d959]/20 hover:text-[#7ec151] transition-colors"
          title="Notifications"
        >
          <Bell className="h-4.5 w-4.5" strokeWidth={1.75} />
        </button>

        <button
          className="rounded-full p-2 text-gray-500 hover:bg-[#b2d959]/20 hover:text-[#7ec151] transition-colors"
          title="Help & Support"
        >
          <HelpCircle className="h-4.5 w-4.5" strokeWidth={1.75} />
        </button>

        <button
          className="rounded-full p-2 text-gray-500 hover:bg-[#b2d959]/20 hover:text-[#7ec151] transition-colors"
          title="Settings"
        >
          <Settings className="h-4.5 w-4.5" strokeWidth={1.75} />
        </button>

        {/* User Initials Avatar Pill (Color Hunt Yellow #FED24F) */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fed24f]/40 text-xs font-black text-[#132a13] border border-[#7ec151]/30 shadow-inner">
          SL
        </div>
      </div>

      <TwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />
    </header>
  );
}
