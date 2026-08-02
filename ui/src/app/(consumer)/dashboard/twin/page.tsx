"use client";

import { TwinChat } from "@/components/shared/twin-chat";

export default function TwinPage() {
  return (
    <TwinChat
      title="AI Twin"
      subtitle="Your financial twin — sees your live balance, budget, and spending."
      welcome="Hi, I'm your AI financial twin. Ask me about your balance, budget, spending, or what to buy — I can see your live data."
      placeholder="Ask about your money…"
    />
  );
}
