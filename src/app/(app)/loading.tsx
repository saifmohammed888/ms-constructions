import { PageLoader, Skeleton } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <PageLoader label="Loading your workspace…" />
      <div className="grid gap-3 sm:grid-cols-3" aria-hidden="true">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    </div>
  );
}
