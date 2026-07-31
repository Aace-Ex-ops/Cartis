import { StatCard } from "@/components/seller/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, CircleCheck } from "lucide-react";
import { tax } from "@/lib/mock-seller";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function TaxPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">GST &amp; Tax</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tax.period} return, filed by {tax.nextFiling}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="GST liability" value={fmt(tax.gstLiability)} />
        <StatCard title="Input tax credit" value={fmt(tax.inputTaxCredit)} />
        <StatCard title="Net payable" value={fmt(tax.netPayable)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filing reminders</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-4 py-3">
            <CalendarClock className="h-4 w-4 shrink-0 text-amber-400" />
            <div className="flex flex-1 flex-col">
              <span className="text-[14px] text-foreground">GSTR-3B due {tax.nextFiling}</span>
              <span className="text-[12px] text-muted-foreground">Net payable {fmt(tax.netPayable)} after ITC</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3">
            <CircleCheck className="h-4 w-4 shrink-0 text-primary" />
            <div className="flex flex-1 flex-col">
              <span className="text-[14px] text-foreground">All expenses GST-tagged</span>
              <span className="text-[12px] text-muted-foreground">Your ITC of {fmt(tax.inputTaxCredit)} is fully claimable</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
