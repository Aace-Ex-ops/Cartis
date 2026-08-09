import { Lock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function RestrictedPage() {
  return (
    <EmptyState
      icon={<Lock className="h-6 w-6 text-muted-foreground" />}
      badge="Access restricted"
      title="This area isn't for you"
      description="Your account type doesn't have access to this page. Switch accounts from the sidebar menu if you own a business profile too."
      cta={{ label: "Back to Home", href: "/" }}
    />
  );
}
