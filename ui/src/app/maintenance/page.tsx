import { Wrench } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function MaintenancePage() {
  return (
    <EmptyState
      icon={<Wrench className="h-6 w-6 text-muted-foreground" />}
      badge="Maintenance"
      title="We'll be right back"
      description="Cartis is undergoing scheduled maintenance. We're adding new features — check back in a few minutes."
    />
  );
}
