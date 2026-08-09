"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Minus, Plus, Trash2 } from "lucide-react";
import { gql } from "@/lib/gql";
import { fetchSellerInventory, fmt, type SellerInventoryItem } from "@/lib/seller";

export default function InventoryPage() {
  const [items, setItems] = useState<SellerInventoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [stock, setStock] = useState("");
  const [reorder, setReorder] = useState("");
  const [cost, setCost] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await fetchSellerInventory());
    } catch {
      setFailed(true);
    }
  }, []);

  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      load();
      loaded.current = true;
    }
  }, [load]);

  const canAdd = name.trim() !== "" && Number.isFinite(Number(stock)) && Number(stock) >= 0;

  async function add() {
    if (!canAdd) return;
    await gql(
      `mutation { addInventoryItem(sku: "${sku.trim() || "SKU-" + Date.now()}", name: "${name.trim()}", stock: ${Number(stock)}, reorderLevel: ${Number(reorder) || 0}, unitCost: ${Number(cost) || 0}) { itemId } }`,
    );
    setSku("");
    setName("");
    setStock("");
    setReorder("");
    setCost("");
    void load();
  }

  async function adjust(itemId: string, delta: number, current: number) {
    const stock2 = Math.max(current + delta, 0);
    await gql(`mutation { updateInventoryItem(itemId: "${itemId}", stock: ${stock2}) { itemId } }`);
    void load();
  }

  async function remove(itemId: string) {
    await gql(`mutation { deleteInventoryItem(itemId: "${itemId}") }`);
    void load();
  }

  if (failed) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Couldn&apos;t load your inventory — refresh to try again.
      </p>
    );
  }

  if (!items) {
    return <div className="h-[190px]" />;
  }

  const cogs = items.reduce((s, i) => s + i.stock * i.unitCost, 0);
  const reorderCount = items.filter((i) => i.stock <= i.reorderLevel).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight text-foreground">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">{items.length} tracked items.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card p-5">
          <span className="text-sm font-medium text-muted-foreground">Stock value (COGS)</span>
          <span className="text-2xl font-semibold text-foreground">{fmt(cogs)}</span>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card p-5">
          <span className="text-sm font-medium text-muted-foreground">Reorder alerts</span>
          <span className="text-2xl font-semibold text-foreground">{reorderCount}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock levels</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border/50 text-[11px] uppercase tracking-wider text-muted-foreground/60">
                <th className="pb-2 pr-4 font-semibold">SKU</th>
                <th className="pb-2 pr-4 font-semibold">Item</th>
                <th className="pb-2 pr-4 text-right font-semibold">Stock</th>
                <th className="pb-2 pr-4 text-right font-semibold">Reorder at</th>
                <th className="pb-2 pr-4 text-right font-semibold">Unit cost</th>
                <th className="pb-2 pr-4 text-right font-semibold">Status</th>
                <th className="pb-2 text-right font-semibold">Adjust</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-[13px] text-muted-foreground">
                    No items tracked yet — add your first below.
                  </td>
                </tr>
              )}
              {items.map((i) => {
                const low = i.stock <= i.reorderLevel;
                return (
                  <tr key={i.itemId} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 font-mono text-muted-foreground">{i.sku}</td>
                    <td className="py-2.5 pr-4 text-foreground">{i.name}</td>
                    <td className="py-2.5 pr-4 text-right text-foreground">{i.stock}</td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground">{i.reorderLevel}</td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground">{fmt(i.unitCost)}</td>
                    <td className="py-2.5 pr-4 text-right">
                      {low ? (
                        <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15">Reorder</Badge>
                      ) : (
                        <Badge className="bg-primary/15 text-primary hover:bg-primary/15">OK</Badge>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => void adjust(i.itemId, -10, i.stock)}
                          disabled={i.stock <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => void adjust(i.itemId, 10, i.stock)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => void remove(i.itemId)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add item</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="inv-sku" className="text-xs text-muted-foreground">SKU</Label>
            <Input id="inv-sku" placeholder="auto" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="inv-name" className="text-xs text-muted-foreground">Item name</Label>
            <Input id="inv-name" placeholder="e.g. Cotton kurta" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="inv-stock" className="text-xs text-muted-foreground">Stock</Label>
            <Input id="inv-stock" type="number" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="inv-reorder" className="text-xs text-muted-foreground">Reorder at</Label>
            <Input id="inv-reorder" type="number" placeholder="0" value={reorder} onChange={(e) => setReorder(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="inv-cost" className="text-xs text-muted-foreground">Unit cost (₹)</Label>
            <Input id="inv-cost" type="number" placeholder="0" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-5">
            <Button size="sm" onClick={() => void add()} disabled={!canAdd}>
              <Plus className="mr-1 h-4 w-4" /> Add item
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
