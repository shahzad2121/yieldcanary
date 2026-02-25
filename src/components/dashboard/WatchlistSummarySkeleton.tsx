import { Skeleton } from '@/components/ui/skeleton';

export function WatchlistSummarySkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <div className="h-4 w-full overflow-hidden rounded-full bg-[#0C141D]">
            <Skeleton className="h-full w-3/4 rounded-full" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
