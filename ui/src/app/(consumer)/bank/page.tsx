import { Landmark, MessageCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SyncPasteBox } from "@/components/shared/sync-paste-box";
import { bankAccount } from "@/lib/mock";

export default function BankPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bank Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your transactions sync from WhatsApp alerts.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Landmark className="h-4 w-4" /> Connected accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-4 py-3">
            <div>
              <div className="text-[14px] font-medium text-foreground">{bankAccount.bank}</div>
              <div className="text-[12px] text-muted-foreground">A/C •••• {bankAccount.last4}</div>
            </div>
            <div className="text-right">
              <div className="text-[16px] font-semibold text-foreground">
                ₹{bankAccount.balance.toLocaleString("en-IN")}
              </div>
              <div className="text-[12px] text-muted-foreground">Balance</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[13px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Last synced {bankAccount.lastSync}
            </span>
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "910000000000"}?text=${encodeURIComponent("Hi Cartis, sync my latest transactions.")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Sync on WhatsApp
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paste bank alerts</CardTitle>
          <CardDescription>Copy alerts from your SMS app and paste them here.</CardDescription>
        </CardHeader>
        <CardContent>
          <SyncPasteBox bank={bankAccount.bank} />
        </CardContent>
      </Card>
    </div>
  );
}
