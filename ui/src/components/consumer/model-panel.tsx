"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { gql } from "@/lib/gql";

type ModelData = { me: { aiModel: string | null } };

const MODELS = [
  {
    id: "@cf/meta/llama-4-scout-17b-16e-instruct",
    name: "Llama 4 Scout (17B)",
    desc: "Fast and accurate. Default for budget and coaching.",
  },
  {
    id: "@cf/meta/llama-3.3-70b-instruct",
    name: "Llama 3.3 (70B)",
    desc: "Smarter, slower. Better for complex financial reasoning.",
  },
  {
    id: "@cf/meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 (8B)",
    desc: "Fastest option. Good for quick queries.",
  },
];

export function ModelPanel() {
  const [current, setCurrent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void gql<ModelData>(`{ me { aiModel } }`)
      .then((d) => setCurrent(d.me.aiModel || MODELS[0].id))
      .catch(() => setCurrent(MODELS[0].id));
  }, []);

  async function setModel(modelId: string) {
    setSaving(true);
    setSaved(false);
    try {
      await gql<{ setAiModel: { aiModel: string } }>(
        `mutation { setAiModel(model: "${modelId}") { aiModel } }`,
      );
      setCurrent(modelId);
      setSaved(true);
    } catch {
      // ignore
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Model</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose the AI model for your coach and budget suggestions.</p>
      </div>

      <div className="flex flex-col gap-3">
        {MODELS.map((m) => (
          <Card
            key={m.id}
            className={`cursor-pointer transition-colors ${current === m.id ? "border-primary" : "border-border/50"}`}
            onClick={() => setModel(m.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[15px]">{m.name}</CardTitle>
                {current === m.id && (
                  <span className="text-[11px] font-medium text-primary">Active</span>
                )}
              </div>
              <CardDescription>{m.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {saved && <p className="text-sm text-green-600">Model updated.</p>}
    </div>
  );
}
