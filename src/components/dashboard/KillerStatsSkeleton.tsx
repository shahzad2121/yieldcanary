import { Skeleton } from '@/components/ui/skeleton';

export function KillerStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-background p-2 sm:p-4"
        >
          <div className="flex items-start justify-between gap-1 sm:gap-2">
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-3 w-16 sm:w-20" />
              <Skeleton className="h-7 sm:h-8 w-10 sm:w-14" />
            </div>
            <Skeleton className="h-4 w-4 sm:h-5 sm:w-5 rounded flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}
