"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Pencil, Plus, Send, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModelSwitcher } from "@/components/shared/model-switcher";
import { gql } from "@/lib/gql";
import { DATA_CHANGED_EVENT } from "@/lib/use-live-data";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type Message = { role: "user" | "assistant"; content: string };
type ChatSession = {
  session_id: string;
  mode: string;
  title: string;
  updated_at: string;
};

const TOOL_PROMPTS: Record<string, string> = {
  budget: "Build me a budget from my recent spending",
  retirement: "How much should I invest monthly to retire at 60?",
  tax: "What can I do to lower my tax this year?",
  stock: "Review my portfolio and flag any risks",
};

type GoalCapture = {
  goal_type: string;
  name: string;
  target_amount: number;
  current_amount?: number;
};

type HoldingCapture = {
  asset_type: string;
  name: string;
  quantity: number;
  avg_price?: number;
};

type ProfileCapture = {
  monthly_income?: number;
  monthly_spend?: number;
  investment_pct?: number;
  housing_cost?: number;
  dependents?: number;
  debt_emis?: number;
  monthly_tax?: number;
};

type BudgetCapture = {
  limit: number;
};

type PurchaseCapture = {
  name: string;
  price: number;
  verdict: string;
  explanation?: string;
};

type IncomeCapture = {
  entry_type: string;
  amount: number;
  category: string;
  description?: string;
};

type ExpenseCapture = {
  entry_type: string;
  amount: number;
  category: string;
  description?: string;
};

type InventoryCapture = {
  name: string;
  stock: number;
  unit_cost?: number;
};

type Captures = {
  goal?: GoalCapture;
  holding?: HoldingCapture;
  profile?: ProfileCapture;
  budget?: BudgetCapture;
  purchase?: PurchaseCapture;
  income?: IncomeCapture;
  expense?: ExpenseCapture;
  inventory?: InventoryCapture;
};

const GOAL_LABELS: Record<string, string> = {
  emergency: "Emergency fund",
  retirement: "Retirement",
  home: "Home",
  education: "Education",
  other: "Goal",
};

const ASSET_LABELS: Record<string, string> = {
  equity: "Stocks",
  mutual_fund: "Mutual fund",
  fd: "Fixed deposit",
  gold: "Gold",
  cash: "Cash",
  other: "Other",
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function CaptureCard({
  title,
  meta,
  saveLabel,
  onSave,
  onDismiss,
}: {
  title: string;
  meta: string;
  saveLabel: string;
  onSave: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elevated">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="max-w-[80%] rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold text-foreground">{title}</p>
          <button
            onClick={onDismiss}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss suggestion"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{meta}</p>
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" className="h-7 px-2.5 text-[12px]" onClick={onSave}>
            {saveLabel}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

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
  welcome,
  placeholder,
  mode,
  tools,
  railOpen,
}: {
  title: string;
  welcome: string;
  placeholder: string;
  mode?: "seller";
  tools?: { id: string; label: string }[];
  railOpen: boolean;
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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [captures, setCaptures] = useState<Captures>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const openSession = async (id: string) => {
    setConfirmDeleteId(null);
    setRenamingId(null);
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
      setCaptures({});
    } catch {
      // ignore
    }
  };

  const newChat = () => {
    setConfirmDeleteId(null);
    setRenamingId(null);
    abortRef.current?.abort();
    setActiveId(null);
    setTool(null);
    setMessages([{ role: "assistant", content: welcome }]);
    setError("");
    setCaptures({});
  };

  const deleteSession = async (id: string) => {
    try {
      const res = await fetch(`${GATEWAY}/api/coach/sessions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) return;
      if (activeId === id) newChat();
      else setConfirmDeleteId(null);
      void loadSessions();
    } catch {
      // ignore
    }
  };

  const renameSession = async (id: string) => {
    const title = renamingTitle.trim();
    setRenamingId(null);
    if (!title) return;
    try {
      const res = await fetch(`${GATEWAY}/api/coach/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title }),
      });
      if (res.ok) void loadSessions();
    } catch {
      // ignore
    }
  };

  const send = async (promptOverride?: string) => {
    const content = (promptOverride ?? input).trim();
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
              capture?: Captures;
            };
            if (ev.error) {
              setError(ev.error);
              done = true;
              break;
            }
            if (ev.sessionId) setActiveId(ev.sessionId);
            if (ev.capture) setCaptures(ev.capture);
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
  const suggestions = tools
    ? tools.map((t) => ({ id: t.id, label: t.label, prompt: TOOL_PROMPTS[t.id] ?? `Use the ${t.label} tool` }))
    : mode === "seller"
      ? [
          { id: "", label: "Cash flow", prompt: "Summarize my cash flow this month and flag anything unusual" },
          { id: "", label: "Inventory", prompt: "Which items should I reorder based on my current stock?" },
          { id: "", label: "Profit", prompt: "How can I improve my profit margin this quarter?" },
          { id: "", label: "Tax", prompt: "What GST filing do I need to worry about next?" },
        ]
      : [
          { id: "", label: "Budget", prompt: "Build me a budget from my recent spending" },
          { id: "", label: "Savings", prompt: "How much should I save each month?" },
          { id: "", label: "Goals", prompt: "Help me set a savings goal for a trip" },
          { id: "", label: "Tax", prompt: "What can I do to lower my tax this year?" },
        ];

  const saveGoal = async () => {
    const goal = captures.goal;
    if (!goal) return;
    try {
      await gql(
        `mutation($goalType: String!, $name: String!, $targetAmount: Float!, $currentAmount: Float) {
          addFinancialGoal(goalType: $goalType, name: $name, targetAmount: $targetAmount, currentAmount: $currentAmount) { goalId }
        }`,
        { goalType: goal.goal_type, name: goal.name, targetAmount: goal.target_amount, currentAmount: goal.current_amount },
      );
      setCaptures((c) => ({ ...c, goal: undefined }));
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
    } catch {
      setError("Couldn't save goal — try again.");
    }
  };

  const saveHolding = async () => {
    const holding = captures.holding;
    if (!holding) return;
    try {
      await gql(
        `mutation($assetType: String!, $name: String!, $quantity: Float!, $avgPrice: Float) {
          addHolding(assetType: $assetType, name: $name, quantity: $quantity, avgPrice: $avgPrice) { holdingId }
        }`,
        { assetType: holding.asset_type, name: holding.name, quantity: holding.quantity, avgPrice: holding.avg_price },
      );
      setCaptures((c) => ({ ...c, holding: undefined }));
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
    } catch {
      setError("Couldn't add purchase — try again.");
    }
  };

  const saveBudget = async () => {
    const budget = captures.budget;
    if (!budget) return;
    try {
      await gql(`mutation { setMonthlyTabLimit(limit: ${budget.limit}) { limit } }`);
      fetch(`${GATEWAY}/api/budget/cache/clear`, { method: "POST", credentials: "include" }).catch(() => {});
      setCaptures((c) => ({ ...c, budget: undefined }));
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
    } catch {
      setError("Couldn't set budget — try again.");
    }
  };

  const saveProfile = async () => {
    const p = captures.profile;
    if (!p) return;
    const fields: string[] = [];
    if (p.monthly_income) fields.push(`monthlyIncome: ${p.monthly_income}`);
    if (p.monthly_spend) fields.push(`monthlySpend: ${p.monthly_spend}`);
    if (p.investment_pct) fields.push(`investmentPct: ${p.investment_pct}`);
    if (p.housing_cost) fields.push(`housingCost: ${p.housing_cost}`);
    if (p.dependents !== undefined) fields.push(`dependents: ${p.dependents}`);
    if (p.debt_emis) fields.push(`debtEmis: ${p.debt_emis}`);
    if (p.monthly_tax) fields.push(`monthlyTax: ${p.monthly_tax}`);
    if (!fields.length) {
      setCaptures((c) => ({ ...c, profile: undefined }));
      return;
    }
    try {
      await gql(`mutation { updateFinancialProfile(${fields.join(", ")}) { id } }`);
      setCaptures((c) => ({ ...c, profile: undefined }));
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
    } catch {
      setError("Couldn't update profile — try again.");
    }
  };

  const savePurchase = async () => {
    const purchase = captures.purchase;
    if (!purchase) return;
    try {
      await gql(
        `mutation($name: String!, $price: Float!, $verdict: String!, $explanation: String) {
          addPurchase(name: $name, price: $price, verdict: $verdict, explanation: $explanation)
        }`,
        { name: purchase.name, price: purchase.price, verdict: purchase.verdict, explanation: purchase.explanation ?? null },
      );
      setCaptures((c) => ({ ...c, purchase: undefined }));
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
    } catch {
      setError("Couldn't add purchase — try again.");
    }
  };

  const saveIncome = async () => {
    const income = captures.income;
    if (!income) return;
    try {
      await gql(
        `mutation($input: FinanceEntryInput!) {
          addFinanceEntry(input: $input) { entryId }
        }`,
        {
          input: {
            entryType: income.entry_type,
            amount: income.amount,
            category: income.category,
            description: income.description ?? income.category,
            transactionDate: new Date().toISOString().slice(0, 10),
          },
        },
      );
      setCaptures((c) => ({ ...c, income: undefined }));
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
    } catch {
      setError("Couldn't record income — try again.");
    }
  };

  const saveExpense = async () => {
    const expense = captures.expense;
    if (!expense) return;
    try {
      await gql(
        `mutation($input: FinanceEntryInput!) {
          addFinanceEntry(input: $input) { entryId }
        }`,
        {
          input: {
            entryType: expense.entry_type,
            amount: expense.amount,
            category: expense.category,
            description: expense.description ?? expense.category,
            transactionDate: new Date().toISOString().slice(0, 10),
          },
        },
      );
      setCaptures((c) => ({ ...c, expense: undefined }));
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
    } catch {
      setError("Couldn't record expense — try again.");
    }
  };

  const saveInventory = async () => {
    const item = captures.inventory;
    if (!item) return;
    try {
      await gql(
        `mutation($name: String!, $stock: Int!, $unitCost: Float!) {
          addInventoryItem(sku: "SKU-${Date.now()}", name: $name, stock: $stock, reorderLevel: 0, unitCost: $unitCost) { itemId }
        }`,
        { name: item.name, stock: Math.floor(item.stock), unitCost: item.unit_cost ?? 0 },
      );
      setCaptures((c) => ({ ...c, inventory: undefined }));
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
    } catch {
      setError("Couldn't add to inventory — try again.");
    }
  };

  const runSuggestion = (s: { id: string; prompt: string }) => {
    setTool(s.id || null);
    void send(s.prompt);
  };

  return (
    <div className="flex h-full min-h-0">
      {railOpen && (
        <div className="flex w-[190px] shrink-0 flex-col border-r border-border/50 bg-muted/20">
          <button
            onClick={newChat}
            className="mx-2 mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-foreground/5"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </button>
          <div className="mt-1 min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
            {sessions.length === 0 && (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">No chats yet</p>
            )}
            {sessions.map((s) => {
              const active = s.session_id === activeId;
              return (
                <div
                  key={s.session_id}
                  className={`group relative mb-0.5 flex items-center rounded-md transition-colors ${
                    active ? "bg-primary/10" : "hover:bg-foreground/5"
                  }`}
                >
                  {renamingId === s.session_id ? (
                    <Input
                      autoFocus
                      value={renamingTitle}
                      onChange={(e) => setRenamingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void renameSession(s.session_id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="h-7 border-0 px-2 text-[12px] shadow-none focus-visible:ring-1"
                    />
                  ) : (
                    <button
                      onClick={() => void openSession(s.session_id)}
                      className="min-w-0 flex-1 px-2 py-1.5 text-left"
                    >
                      <span className={`block truncate text-[12px] ${active ? "font-medium text-foreground" : "text-foreground/80"}`}>
                        {s.title || "New chat"}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {timeAgo(s.updated_at)}
                      </span>
                    </button>
                  )}
                  {renamingId !== s.session_id && (
                    <div className="absolute right-1 hidden items-center gap-0.5 group-hover:flex">
                      {confirmDeleteId === s.session_id ? (
                        <button
                          onClick={() => void deleteSession(s.session_id)}
                          className="rounded-md bg-destructive/15 p-1 text-destructive"
                          aria-label="Confirm delete session"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setRenamingId(s.session_id);
                              setRenamingTitle(s.title);
                            }}
                            className="rounded-md p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                            aria-label="Rename session"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(s.session_id)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                            aria-label="Delete session"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:thin]">
          {listActive && messages.length === 1 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 pb-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="max-w-[320px]">
                <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">{welcome}</p>
              </div>
              <div className="grid w-full max-w-[340px] grid-cols-2 gap-2 pt-1">
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => runSuggestion(s)}
                    className="rounded-lg border border-border/60 bg-background px-2.5 py-2 text-left text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    <span className="block font-medium text-foreground">{s.label}</span>
                    {s.prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!(listActive && messages.length === 1) && (
            <div className="flex flex-col gap-3">
              {(listActive ? messages.slice(1) : messages).map((m, i) => (
                <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
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
                    className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border/50 bg-background/60 text-foreground"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {(captures.goal || captures.holding || captures.profile || captures.budget || captures.purchase || captures.income || captures.expense || captures.inventory) && (
                <>
                  {captures.income && (
                    <CaptureCard
                      title="Record income"
                      meta={`${inr(captures.income.amount)} · ${captures.income.category}${
                        captures.income.description ? ` — ${captures.income.description}` : ""
                      }`}
                      saveLabel="Save income"
                      onSave={() => void saveIncome()}
                      onDismiss={() => setCaptures((c) => ({ ...c, income: undefined }))}
                    />
                  )}
                  {captures.expense && (
                    <CaptureCard
                      title="Record expense"
                      meta={`${inr(captures.expense.amount)} · ${captures.expense.category}${
                        captures.expense.description ? ` — ${captures.expense.description}` : ""
                      }`}
                      saveLabel="Save expense"
                      onSave={() => void saveExpense()}
                      onDismiss={() => setCaptures((c) => ({ ...c, expense: undefined }))}
                    />
                  )}
                  {captures.inventory && (
                    <CaptureCard
                      title="Add to inventory"
                      meta={`${captures.inventory.name} · ${Math.floor(captures.inventory.stock)} units${
                        typeof captures.inventory.unit_cost === "number" ? ` @ ${inr(captures.inventory.unit_cost)}` : ""
                      }`}
                      saveLabel="Save item"
                      onSave={() => void saveInventory()}
                      onDismiss={() => setCaptures((c) => ({ ...c, inventory: undefined }))}
                    />
                  )}
                  {captures.purchase && (
                    <CaptureCard
                      title={captures.purchase.name}
                      meta={`${inr(captures.purchase.price)} · ${captures.purchase.verdict}${
                        captures.purchase.explanation ? ` — ${captures.purchase.explanation}` : ""
                      }`}
                      saveLabel="Add to purchases"
                      onSave={() => void savePurchase()}
                      onDismiss={() => setCaptures((c) => ({ ...c, purchase: undefined }))}
                    />
                  )}
                  {captures.goal && (
                    <CaptureCard
                      title={captures.goal.name}
                      meta={`${GOAL_LABELS[captures.goal.goal_type] ?? "Goal"} · ${inr(captures.goal.target_amount)}${
                        typeof captures.goal.current_amount === "number"
                          ? ` · ${inr(captures.goal.current_amount)} saved`
                          : ""
                      }`}
                      saveLabel="Save goal"
                      onSave={() => void saveGoal()}
                      onDismiss={() => setCaptures((c) => ({ ...c, goal: undefined }))}
                    />
                  )}
                  {captures.holding && (
                    <CaptureCard
                      title={captures.holding.name}
                      meta={`${ASSET_LABELS[captures.holding.asset_type] ?? "Investment"} · ${captures.holding.quantity} units${
                        typeof captures.holding.avg_price === "number"
                          ? ` @ ${inr(captures.holding.avg_price)}`
                          : ""
                      }`}
                      saveLabel="Add purchase"
                      onSave={() => void saveHolding()}
                      onDismiss={() => setCaptures((c) => ({ ...c, holding: undefined }))}
                    />
                  )}
                  {captures.budget && (
                    <CaptureCard
                      title="Set monthly budget"
                      meta={`${inr(captures.budget.limit)}/month`}
                      saveLabel="Save budget"
                      onSave={() => void saveBudget()}
                      onDismiss={() => setCaptures((c) => ({ ...c, budget: undefined }))}
                    />
                  )}
                  {captures.profile && (
                    <CaptureCard
                      title="Update financial profile"
                      meta={
                        Object.entries({
                          "income": captures.profile.monthly_income ? inr(captures.profile.monthly_income) + "/mo" : "",
                          "spend": captures.profile.monthly_spend ? inr(captures.profile.monthly_spend) + "/mo" : "",
                          "invest": captures.profile.investment_pct !== undefined ? `${captures.profile.investment_pct}%` : "",
                          "housing": captures.profile.housing_cost ? inr(captures.profile.housing_cost) + "/mo" : "",
                          "dependents": captures.profile.dependents !== undefined ? `${captures.profile.dependents}` : "",
                          "debt EMI": captures.profile.debt_emis ? inr(captures.profile.debt_emis) + "/mo" : "",
                          "tax": captures.profile.monthly_tax ? inr(captures.profile.monthly_tax) + "/mo" : "",
                        })
                          .filter(([, v]) => v)
                          .map(([k, v]) => `${k} ${v}`)
                          .join(" · ")
                      }
                      saveLabel="Save profile"
                      onSave={() => void saveProfile()}
                      onDismiss={() => setCaptures((c) => ({ ...c, profile: undefined }))}
                    />
                  )}
                </>
              )}
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
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="px-4 pb-1 text-[12px] text-destructive">{error}</p>}

        <div className="border-t border-border/50 p-3">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <ModelSwitcher />
          </div>
          <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-background p-2 transition-colors focus-within:border-primary/40">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={placeholder}
              disabled={busy}
              className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent px-1 py-0.5 text-[13px] outline-none placeholder:text-muted-foreground"
            />
            <Button size="icon" onClick={() => void send()} disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
