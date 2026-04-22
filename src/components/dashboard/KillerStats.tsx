import { Skull, Heart, AlertTriangle, LayoutGrid, Eye } from 'lucide-react';
import { ETF } from '@/types/etf';

interface KillerStatsProps {
  etfs: ETF[];
}

export function KillerStats({ etfs }: KillerStatsProps) {
  const totalCount = etfs.length;
  const healthyCount = etfs.filter((e) => e.canaryStatus === 'Healthy').length;
  const watchCount = etfs.filter((e) => e.canaryStatus === 'Watch').length;
  const highRiskCount = etfs.filter((e) => e.canaryStatus === 'High Risk').length;
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
      label: 'On Watch',
      value: watchCount,
      icon: Eye,
      iconClassName: 'text-yellow-500',
    },
    {
      label: 'High Risk ETFs',
      value: highRiskCount,
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
    <div className="grid grid-cols-6 sm:grid-cols-5 gap-2 sm:gap-3">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`rounded-lg border border-border bg-background p-2 sm:p-3 animate-fade-in ${
            index < 2 ? 'col-span-3 sm:col-span-1' : 'col-span-2 sm:col-span-1'
          }`}
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div className="flex items-start justify-between gap-1 sm:gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wide leading-tight break-words whitespace-normal">
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
