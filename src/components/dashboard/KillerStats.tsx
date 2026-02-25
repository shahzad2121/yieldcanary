import { Skull, Heart, AlertTriangle, LayoutGrid } from 'lucide-react';
import { ETF } from '@/types/etf';

interface KillerStatsProps {
  etfs: ETF[];
}

export function KillerStats({ etfs }: KillerStatsProps) {
  const totalCount = etfs.length;
  const healthyCount = etfs.filter((e) => e.canaryStatus === 'Healthy').length;
  const dyingCount = etfs.filter((e) => e.canaryStatus === 'Dying').length;
  const deadCount = etfs.filter((e) => e.canaryStatus === 'Dead').length;

  const stats = [
    {
      label: 'Total ETFs',
      value: totalCount,
      icon: LayoutGrid,
    },
    {
      label: 'Healthy ETFs',
      value: healthyCount,
      icon: Heart,
    },
    {
      label: 'Dying ETFs',
      value: dyingCount,
      icon: AlertTriangle,
    },
    {
      label: 'Dead ETFs',
      value: deadCount,
      icon: Skull,
    },
  ];

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
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">
                {stat.label}
              </p>
              <p className="text-lg sm:text-2xl lg:text-3xl font-bold font-mono mt-0.5 text-foreground">
                {stat.value}
              </p>
            </div>
            <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}
