import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/seller/stat-card";
import { inventory } from "@/lib/mock-seller";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function InventoryPage() {
  const cogs = inventory.reduce((s, i) => s + i.cogs, 0);
  const reorder = inventory.filter((i) => i.stock <= i.reorder);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">{inventory.length} tracked items.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="Stock value (COGS)" value={fmt(cogs)} />
        <StatCard title="Reorder alerts" value={String(reorder.length)} />
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
                <th className="pb-2 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((i) => {
                const low = i.stock <= i.reorder;
                return (
                  <tr key={i.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 font-mono text-muted-foreground">{i.sku}</td>
                    <td className="py-2.5 pr-4 text-foreground">{i.name}</td>
                    <td className="py-2.5 pr-4 text-right text-foreground">{i.stock}</td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground">{i.reorder}</td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground">{fmt(i.unitCost)}</td>
                    <td className="py-2.5 text-right">
                      {low ? (
                        <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15">Reorder</Badge>
                      ) : (
                        <Badge className="bg-primary/15 text-primary hover:bg-primary/15">OK</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
