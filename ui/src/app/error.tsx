"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={<AlertTriangle className="h-6 w-6 text-destructive" />}
      badge="Something went wrong"
      title="We hit a snag"
      description="An unexpected error occurred. Reload the page to try again — your data is safe."
      cta={{ label: "Try again", href: "/" }}
    />
  );
}
