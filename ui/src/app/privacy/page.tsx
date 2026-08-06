import type { Metadata } from "next";
import { TermsPanel } from "@/components/consumer/terms-panel";

export const metadata: Metadata = { title: "Privacy Policy — Cartis" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <TermsPanel />
    </div>
  );
}