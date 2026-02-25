import { KillerStatsSkeleton } from './KillerStatsSkeleton';
import { ETFTableSkeleton } from './ETFTableSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { Footer } from '@/components/Footer';

/** Shown in dashboard layout while auth or initial load is resolving. */
export function DashboardContentSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header placeholder so layout doesn't shift */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 sm:h-16 items-center gap-2 px-3 sm:px-4">
          <Skeleton className="h-9 flex-1 max-w-md" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div className="container py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="text-center space-y-2 py-2 sm:py-4">
          <Skeleton className="h-8 sm:h-9 w-72 sm:w-96 mx-auto" />
          <Skeleton className="h-4 sm:h-5 w-64 sm:w-80 mx-auto" />
        </div>
        <KillerStatsSkeleton />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
        <ETFTableSkeleton />
        <Footer showDataDisclaimer={true} />
      </div>
    </div>
  );
}
