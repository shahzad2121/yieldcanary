import { Heart, AlertTriangle, Skull } from 'lucide-react';
import type { MarketSnapshotStatus } from '@/lib/marketSnapshotStatus';

interface MarketSnapshotStatusIconProps {
  status: MarketSnapshotStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  MarketSnapshotStatus,
  { Icon: typeof Heart; className: string }
> = {
  Healthy: {
    Icon: Heart,
    className: 'text-emerald-600 dark:text-emerald-400',
  },
  Dying: {
    Icon: AlertTriangle,
    className: 'text-amber-600 dark:text-amber-400',
  },
  Dead: {
    Icon: Skull,
    className: 'text-red-600 dark:text-red-400',
  },
};

export function MarketSnapshotStatusIcon({
  status,
  className = 'h-4 w-4 flex-shrink-0',
}: MarketSnapshotStatusIconProps) {
  const { Icon, className: statusClass } = STATUS_CONFIG[status];
  return <Icon className={`${statusClass} ${className}`} aria-label={status} />;
}
