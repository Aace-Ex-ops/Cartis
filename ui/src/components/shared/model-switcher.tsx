"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Cpu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { gql } from "@/lib/gql";

const MODELS = [
  {
    id: "@cf/meta/llama-4-scout-17b-16e-instruct",
    name: "Llama 4 Scout",
  },
  {
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    name: "Llama 3.3 70B",
  },
  {
    id: "@cf/meta/llama-3.1-8b-instruct-fp8",
    name: "Llama 3.1 8B",
  },
  {
    id: "groq/llama-3.3-70b-versatile",
    name: "Llama 3.3 70B (Groq)",
  },
  {
    id: "groq/openai/gpt-oss-120b",
    name: "GPT-OSS 120B (Groq)",
  },
  {
    id: "groq/llama-3.1-8b-instant",
    name: "Llama 3.1 8B (Groq)",
  },
];

type ModelData = { me: { aiModel: string | null } };

export function ModelSwitcher() {
  const [current, setCurrent] = useState<string>(MODELS[0].id);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void gql<ModelData>(`{ me { aiModel } }`)
      .then((d) => {
        if (cancelled) return;
        if (d.me.aiModel) setCurrent(d.me.aiModel);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  async function setModel(modelId: string) {
    try {
      await gql<{ setAiModel: { aiModel: string } }>(
        `mutation { setAiModel(model: "${modelId}") { aiModel } }`,
      );
      setCurrent(modelId);
    } catch {
      // ignore
    }
  }

  const active = MODELS.find((m) => m.id === current) ?? MODELS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          disabled={!loaded}
          aria-label="Switch AI model"
        >
          <Cpu className="h-3 w-3" />
          {active.name}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {MODELS.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => void setModel(m.id)}
            className="cursor-pointer justify-between"
          >
            <span>{m.name}</span>
            {m.id === current && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
