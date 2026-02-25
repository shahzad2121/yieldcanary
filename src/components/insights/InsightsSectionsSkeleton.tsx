import { Skeleton } from '@/components/ui/skeleton';

/** Placeholder for insights section cards while data is loading. */
export function InsightsSectionsSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Single full-width card skeletons (approx 7) */}
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Skeleton className="h-6 w-48 sm:w-64" />
            <Skeleton className="h-9 w-24 self-end sm:self-auto" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
      ))}

      {/* Last row: 2 columns (pair layout) */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6 space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6 space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
