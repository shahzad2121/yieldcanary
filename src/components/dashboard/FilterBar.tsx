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

  return (
    <div className="flex flex-wrap items-center gap-2 xs:gap-3">
      <div className="flex items-center gap-1 xs:gap-2 text-xs xs:text-sm text-muted-foreground">
        <Filter className="h-3.5 w-3.5 xs:h-4 xs:w-4 flex-shrink-0" />
        <span className="hidden xs:inline">Filters:</span>
      </div>

      {/* Status Filter Buttons */}
      <div className="flex items-center gap-1 xs:gap-2 flex-wrap">
        <button
          className={`h-6 xs:h-7 px-2 xs:px-3 text-xs xs:text-sm rounded-md font-medium transition-colors focus:outline-none ${
            statusFilter === 'all'
              ? 'bg-green-500 text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onStatusFilterChange('all')}
        >
          All
        </button>
        <button
          className={`h-6 xs:h-7 px-2 xs:px-3 text-xs xs:text-sm rounded-md font-medium transition-colors focus:outline-none ${
            statusFilter === 'Healthy'
              ? 'bg-green-500 text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onStatusFilterChange('Healthy')}
        >
          Healthy
        </button>
        <button
          className={`h-6 xs:h-7 px-2 xs:px-3 text-xs xs:text-sm rounded-md font-medium transition-colors focus:outline-none ${
            statusFilter === 'Watch'
              ? 'bg-amber-500 text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onStatusFilterChange('Watch')}
        >
          Watch
        </button>
        <button
          className={`h-6 xs:h-7 px-2 xs:px-3 text-xs xs:text-sm rounded-md font-medium transition-colors focus:outline-none ${
            statusFilter === 'High Risk'
              ? 'bg-orange-500 text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onStatusFilterChange('High Risk')}
        >
          High Risk
        </button>
        <button
          className={`h-6 xs:h-7 px-2 xs:px-3 text-xs xs:text-sm rounded-md font-medium transition-colors focus:outline-none ${
            statusFilter === 'Severe Risk'
              ? 'bg-red-500 text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onStatusFilterChange('Severe Risk')}
        >
          Severe Risk
        </button>
      </div>
      {/* Clear Filters — driven by parent so search + compare URL params also surface Clear */}
      {showClearButton && (
        <button
          className="h-6 xs:h-7 px-1.5 xs:px-2 text-xs xs:text-sm text-muted-foreground hover:text-foreground rounded-md transition-colors focus:outline-none flex items-center"
          onClick={onClearFilters}
        >
          <X className="h-3 w-3 mr-0.5 xs:mr-1 flex-shrink-0" />
          <span className="hidden xs:inline">Clear</span>
        </button>
      )}
    </div>
  );
}
