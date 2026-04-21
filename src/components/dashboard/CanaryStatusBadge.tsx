import { CanaryStatus } from '@/types/etf';

interface CanaryStatusBadgeProps {
  status: CanaryStatus;
  showLabel?: boolean;
}

const STATUS_STYLES: Record<CanaryStatus, string> = {
  Healthy: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Watch: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  'High Risk': 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  'Severe Risk': 'bg-red-500/10 text-red-600 border-red-500/30',
};

export function CanaryStatusBadge({ status, showLabel = true }: CanaryStatusBadgeProps) {
  const styles = STATUS_STYLES[status] || 'bg-secondary text-foreground border-border';

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
      {showLabel && <span>{status}</span>}
    </div>
  );
}
