import { Skeleton } from '@/components/ui/skeleton';

const ROW_COUNT = 10;
const HEADER_CELLS = 18;

export function ETFTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-8 w-28 sm:w-32" />
      </div>

      {/* Desktop table skeleton */}
      <div className="hidden md:block rounded-xl border border-border bg-background overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {Array.from({ length: HEADER_CELLS }).map((_, i) => (
                  <th key={i} className="px-2 py-3 text-left">
                    <Skeleton className="h-4 w-16 sm:w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: ROW_COUNT }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/50">
                  {Array.from({ length: HEADER_CELLS }).map((_, cellIndex) => (
                    <td key={cellIndex} className="px-2 py-2">
                      <Skeleton
                        className="h-4"
                        style={{
                          width: cellIndex === 1 ? 48 : cellIndex === 2 ? 120 : 56,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards skeleton */}
      <div className="md:hidden space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-9" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-6 w-14" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
