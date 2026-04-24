import { CanaryStatus } from '@/types/etf';
import { Filter, X } from 'lucide-react';

interface FilterBarProps {
  statusFilter: CanaryStatus | 'all';
  onStatusFilterChange: (status: CanaryStatus | 'all') => void;
  onClearFilters: () => void;
  /** When true, show Clear (status, header search, URL compare params, etc. are active in parent). */
  showClearButton: boolean;
}

export function FilterBar({
  statusFilter,
  onStatusFilterChange,
  onClearFilters,
  showClearButton,
}: FilterBarProps) {

  const pillClass = (active: boolean, activeBg: string) =>
    `h-6 xs:h-7 shrink-0 whitespace-nowrap px-1.5 xs:px-2 sm:px-3 text-[11px] xs:text-xs sm:text-sm rounded-md font-medium transition-colors focus:outline-none ${
      active ? `${activeBg} text-white` : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 xs:gap-3">
      <div className="flex shrink-0 items-center gap-1 xs:gap-2 text-xs xs:text-sm text-muted-foreground">
        <Filter
          className="h-3.5 w-3.5 xs:h-4 xs:w-4 shrink-0 text-primary"
          fill="currentColor"
          strokeWidth={0}
          aria-hidden
        />
        <span className="hidden xs:inline">Filters:</span>
      </div>

      {/* Single horizontal row; scroll on very narrow screens so Severe stays after High Risk */}
      <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain custom-scrollbar">
        <div className="flex w-max flex-nowrap items-center gap-1 xs:gap-2 py-0.5">
          <button
            className={pillClass(statusFilter === 'all', 'bg-green-500')}
            onClick={() => onStatusFilterChange('all')}
          >
            All
          </button>
          <button
            className={pillClass(statusFilter === 'Healthy', 'bg-green-500')}
            onClick={() => onStatusFilterChange('Healthy')}
          >
            Healthy
          </button>
          <button
            className={pillClass(statusFilter === 'Watch', 'bg-yellow-500')}
            onClick={() => onStatusFilterChange('Watch')}
          >
            Watch
          </button>
          <button
            className={pillClass(statusFilter === 'High Risk', 'bg-orange-500')}
            onClick={() => onStatusFilterChange('High Risk')}
          >
            High Risk
          </button>
          <button
            className={pillClass(statusFilter === 'Severe Risk', 'bg-red-500')}
            onClick={() => onStatusFilterChange('Severe Risk')}
          >
            Severe Risk
          </button>
        </div>
      </div>
      {/* Clear Filters — driven by parent so search + compare URL params also surface Clear */}
      {showClearButton && (
        <button
          className="h-6 xs:h-7 shrink-0 px-1.5 xs:px-2 text-xs xs:text-sm text-muted-foreground hover:text-foreground rounded-md transition-colors focus:outline-none flex items-center"
          onClick={onClearFilters}
        >
          <X className="h-3 w-3 mr-0.5 xs:mr-1 flex-shrink-0" />
          <span className="hidden xs:inline">Clear</span>
        </button>
      )}
    </div>
  );
}
