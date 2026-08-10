"use client";

import { useState } from "react";
import { ProfilePanel } from "@/components/consumer/profile-panel";
import { SupportPanel } from "@/components/consumer/support-panel";
import { TermsPanel } from "@/components/consumer/terms-panel";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "support", label: "Support" },
  { id: "terms", label: "Terms & Policies" },
] as const;

export function SettingsPanel() {
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("profile");

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <nav className="flex w-44 shrink-0 flex-col gap-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
              section === s.id
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div data-lenis-prevent className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-2">
        {section === "profile" && <ProfilePanel />}
        {section === "support" && <SupportPanel />}
        {section === "terms" && <TermsPanel />}
      </div>
    </div>
  );
}
