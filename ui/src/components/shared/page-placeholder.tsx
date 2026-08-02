export function PagePlaceholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-24 text-center">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {note ?? "Coming in the next sprint."}
      </p>
    </div>
  );
}
