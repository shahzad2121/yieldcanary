import { Skull, Heart, AlertTriangle, LayoutGrid } from 'lucide-react';
import { ETF } from '@/types/etf';

interface KillerStatsProps {
  etfs: ETF[];
}

export function KillerStats({ etfs }: KillerStatsProps) {
  const totalCount = etfs.length;
  const healthyCount = etfs.filter((e) => e.canaryStatus === 'Healthy').length;
  // Watch + High Risk combined — funds showing some erosion signal worth monitoring
  const atRiskCount = etfs.filter(
    (e) => e.canaryStatus === 'Watch' || e.canaryStatus === 'High Risk'
  ).length;
  const severeRiskCount = etfs.filter((e) => e.canaryStatus === 'Severe Risk').length;

  const stats = [
    {
      label: 'Total ETFs',
      value: totalCount,
      icon: LayoutGrid,
      iconClassName: 'text-primary',
    },
    {
      label: 'Healthy ETFs',
      value: healthyCount,
      icon: Heart,
      iconClassName: 'text-emerald-500',
    },
    {
      label: 'At Risk ETFs',
      value: atRiskCount,
      icon: AlertTriangle,
      iconClassName: 'text-orange-500',
    },
    {
      label: 'Severe Risk ETFs',
      value: severeRiskCount,
      icon: Skull,
      iconClassName: 'text-red-500',
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="rounded-lg border border-border bg-background p-2 sm:p-4 animate-fade-in"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div className="flex items-start justify-between gap-1 sm:gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wider truncate">
                {stat.label}
              </p>
              <p className="text-lg sm:text-2xl lg:text-2xl font-bold font-mono mt-0.5 text-foreground">
                {stat.value}
              </p>
            </div>
            <stat.icon
              className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${stat.iconClassName}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
