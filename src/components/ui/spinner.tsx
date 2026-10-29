import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  label?: string;
};

/**
 * A CSS-only loader avoids the SVG rotation hiccup that can appear during
 * route hydration. It is deliberately tiny so it can be used in buttons,
 * forms, and page-level loading states alike.
 */
export function Spinner({ className, label = "Loading" }: SpinnerProps) {
  return (
    <span
      aria-label={label}
      role="status"
      className={cn(
        "app-spinner relative inline-flex size-4 shrink-0",
        className,
      )}
    >
      <span aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-current/15" />
      <span aria-hidden="true" className="app-spinner-indicator absolute inset-0 rounded-full border-2 border-transparent border-t-current border-r-current/60" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton-shimmer rounded-lg bg-muted", className)} />;
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-black/5 bg-white/70 px-6 text-center text-sm text-muted-foreground shadow-sm" aria-live="polite">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Spinner className="size-5" label={label} />
      </span>
      <p>{label}</p>
    </div>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
