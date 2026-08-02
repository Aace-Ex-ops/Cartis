"use client";

import { TwinChat } from "@/components/shared/twin-chat";

export default function SellerTwinPage() {
  return (
    <TwinChat
      mode="seller"
      title="AI Twin"
      subtitle="Your business twin — ask about revenue, expenses, margins, or what to do next."
      welcome="Hi, I'm your AI business twin. Ask me about your revenue, expenses, margins, inventory, or cash flow — I can see your business numbers."
      placeholder="Ask about your business…"
    />
  );
}
