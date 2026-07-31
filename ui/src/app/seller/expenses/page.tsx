import { CategoryPie } from "@/components/seller/category-pie";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { expenseList, expenseCategories } from "@/lib/mock-seller";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function ExpensesPage() {
  const top3 = [...expenseCategories].sort((a, b) => b.spent - a.spent).slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Expenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every rupee out, categorized.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Latest expenses</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border/50">
              {expenseList.map((e) => (
                <div key={e.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-medium text-foreground">{e.item}</span>
                    <span className="text-[12px] text-muted-foreground">{e.date}</span>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">{e.category}</Badge>
                  <span className="w-24 text-right text-[14px] text-foreground">{fmt(e.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <CategoryPie title="By category" data={expenseCategories} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Largest categories</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {top3.map((c, i) => (
            <div key={c.name} className="flex items-center gap-3 text-[14px]">
              <span className="w-5 text-muted-foreground">#{i + 1}</span>
              <span className="flex-1 text-foreground">{c.name}</span>
              <span className="font-medium text-foreground">{fmt(c.spent)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
