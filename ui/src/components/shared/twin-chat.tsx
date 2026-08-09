"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, MessageSquarePlus, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type Message = { role: "user" | "assistant"; content: string };
type ChatSession = {
  session_id: string;
  mode: string;
  title: string;
  updated_at: string;
};

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

export function TwinChat({
  title,
  subtitle,
  welcome,
  placeholder,
  mode,
  tools,
}: {
  title: string;
  subtitle: string;
  welcome: string;
  placeholder: string;
  mode?: "seller";
  tools?: { id: string; label: string }[];
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: welcome },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY}/api/coach/sessions`, {
        credentials: "include",
      });
      if (res.ok) setSessions((await res.json()) as ChatSession[]);
    } catch {
      // list is non-critical
    }
  }, []);

  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      void loadSessions();
    }
  }, [loadSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const openSession = async (id: string) => {
    abortRef.current?.abort();
    try {
      const res = await fetch(`${GATEWAY}/api/coach/sessions/${id}/messages`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const rows = (await res.json()) as Message[];
      setMessages(rows.length ? rows : [{ role: "assistant", content: welcome }]);
      setActiveId(id);
      setError("");
    } catch {
      // ignore
    }
  };

  const newChat = () => {
    abortRef.current?.abort();
    setActiveId(null);
    setTool(null);
    setMessages([{ role: "assistant", content: welcome }]);
    setError("");
  };

  const send = async () => {
    const content = input.trim();
    if (!content || busy) return;
    setMessages((m) => [...m, { role: "user" as const, content }]);
    setInput("");
    setBusy(true);
    setError("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`${GATEWAY}/api/coach/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({ session_id: activeId ?? undefined, mode, tool: tool ?? undefined, message: content }),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Chat failed — try again.");
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        buf += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          if (data === "[DONE]") {
            done = true;
            break;
          }
          try {
            const ev = JSON.parse(data) as {
              token?: string;
              error?: string;
              sessionId?: string;
            };
            if (ev.error) {
              setError(ev.error);
              done = true;
              break;
            }
            if (ev.sessionId) setActiveId(ev.sessionId);
            if (ev.token) {
              setMessages((m) => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                if (!last || last.role !== "assistant") return m;
                copy[copy.length - 1] = { ...last, content: last.content + ev.token! };
                return copy;
              });
            }
          } catch {
            // partial frame — skip
          }
        }
      }
      setMessages((m) =>
        m[m.length - 1]?.role === "assistant" && !m[m.length - 1].content
          ? m.slice(0, -1)
          : m,
      );
      void loadSessions();
    } catch {
      setError("Chat failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  const listActive = !activeId;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={newChat} disabled={busy}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
          New chat
        </Button>
      </div>

      {sessions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {sessions.map((s) => (
            <button
              key={s.session_id}
              onClick={() => void openSession(s.session_id)}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                s.session_id === activeId
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/50 bg-background/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="block max-w-[180px] truncate font-medium">{s.title || "New chat"}</span>
              <span className="block text-[10px] opacity-70">{timeAgo(s.updated_at)}</span>
            </button>
          ))}
        </div>
      )}

      {listActive && tools && (
        <div className="flex flex-wrap gap-2">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(tool === t.id ? null : t.id)}
              className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                tool === t.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/50 bg-background/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <Card className="min-h-[420px]">
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {listActive && messages.length === 1 && (
              <div className="flex gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elevated">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-[13px] text-muted-foreground">
                  {welcome}
                </div>
              </div>
            )}
            {(listActive ? messages.slice(1) : messages).map((m, i) => (
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
              placeholder={placeholder}
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
