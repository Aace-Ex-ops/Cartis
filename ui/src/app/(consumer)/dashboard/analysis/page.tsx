import { AnalysisList } from "@/components/consumer/analysis-list";
import { analyses } from "@/lib/mock";

export default function AnalysisPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analysis History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every verdict your coach gave, in one place.</p>
      </div>
      <AnalysisList analyses={analyses} />
    </div>
  );
}
