import { Compass } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      icon={<Compass className="h-6 w-6 text-muted-foreground" />}
      badge="404"
      title="Lost in the ledger?"
      description="The page or purchase verdict you're looking for doesn't exist, was moved, or has expired."
      cta={{ label: "Return to Home", href: "/" }}
    />
  );
}
