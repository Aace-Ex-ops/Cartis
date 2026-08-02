"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type Message = { role: "user" | "assistant"; content: string };

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hi, I'm your AI financial twin. Ask me about your balance, budget, spending, or what to buy — I can see your live data.",
};

export default function TwinPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const content = input.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${GATEWAY}/api/coach/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: next }),
      });
      const body = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !body.reply) {
        setError(body.error ?? "Chat failed — try again.");
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: body.reply! }]);
    } catch {
      setError("Chat failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI Twin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your financial twin — sees your live balance, budget, and spending.
        </p>
      </div>

      <Card className="min-h-[420px]">
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-elevated"
                  }`}
                >
                  {m.role === "user" ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background/60 border border-border/50 text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elevated">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-[13px] text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && <p className="text-[13px] text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Input
              placeholder="Ask about your money…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              disabled={busy}
            />
            <Button onClick={() => void send()} disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
