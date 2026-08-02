import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function CategoryBreakdown({ categories }: {
  categories: { name: string; spent: number; color: string }[];
}) {
  const total = categories.reduce((s, c) => s + c.spent, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>By category</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {categories.map((c) => (
          <div key={c.name} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2 text-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </span>
              <span className="text-muted-foreground">
                {fmt(c.spent)} · {Math.round((c.spent / total) * 100)}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full" style={{ width: `${(c.spent / total) * 100}%`, background: c.color }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
