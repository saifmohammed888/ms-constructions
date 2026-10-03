export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4" aria-label="Loading">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3"><div className="h-28 animate-pulse rounded-2xl bg-muted" /><div className="h-28 animate-pulse rounded-2xl bg-muted" /><div className="h-28 animate-pulse rounded-2xl bg-muted" /></div>
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
