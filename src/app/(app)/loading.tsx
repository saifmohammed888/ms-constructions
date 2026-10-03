export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4" aria-label="Loading">
      <div className="skeleton-shimmer h-9 w-48 rounded-lg bg-muted" />
      <div className="skeleton-shimmer h-4 w-72 rounded bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3"><div className="skeleton-shimmer h-28 rounded-2xl bg-muted" /><div className="skeleton-shimmer h-28 rounded-2xl bg-muted" /><div className="skeleton-shimmer h-28 rounded-2xl bg-muted" /></div>
      <div className="skeleton-shimmer h-64 rounded-2xl bg-muted" />
    </div>
  );
}
