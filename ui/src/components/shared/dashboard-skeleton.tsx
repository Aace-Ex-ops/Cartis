import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonHeading({ title = "w-48", sub = "w-72" }: { title?: string; sub?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className={`h-7 ${title}`} />
      <Skeleton className={`h-4 ${sub}`} />
    </div>
  );
}

export function SkeletonCard({ className = "h-[190px]" }: { className?: string }) {
  return <Skeleton className={`rounded-xl border border-border/50 bg-background/60 ${className}`} />;
}

export function SkeletonRow({ withBadge = true, bare = false }: { withBadge?: boolean; bare?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${bare ? "" : "rounded-xl border border-border/50 bg-background/60 px-4 py-3"}`}>
      <Skeleton className="size-8 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      {withBadge && <Skeleton className="h-5 w-14 shrink-0 rounded-full" />}
    </div>
  );
}
