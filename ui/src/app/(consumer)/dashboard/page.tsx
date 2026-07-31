import { HealthScoreCard } from "@/components/consumer/health-score-card";
import { WalletCard } from "@/components/consumer/wallet-card";
import { TabGauge } from "@/components/consumer/tab-gauge";
import { AlertList } from "@/components/consumer/alert-list";
import { health, wallet, alerts } from "@/lib/mock";

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Good morning, Aarav</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s where your money stands today.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HealthScoreCard score={health.score} level={health.level} insight={health.insight} />
        </div>
        <WalletCard
          balance={wallet.balance}
          credits={wallet.credits}
          monthlySpend={wallet.monthlySpend}
          monthlyBudget={wallet.monthlyBudget}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TabGauge spend={wallet.monthlySpend} budget={wallet.monthlyBudget} />
        <div className="lg:col-span-2">
          <AlertList alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
