import { Skull, Heart, AlertTriangle } from 'lucide-react';
import { ETF } from '@/types/etf';

interface KillerStatsProps {
  etfs: ETF[];
}

export function KillerStats({ etfs }: KillerStatsProps) {
  const healthyCount = etfs.filter((e) => e.canaryStatus === 'Healthy').length;
  const dyingCount = etfs.filter((e) => e.canaryStatus === 'Dying').length;
  const deadCount = etfs.filter((e) => e.canaryStatus === 'Dead').length;

  const stats = [
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
    <div className="grid grid-cols-3 gap-2 xs:gap-3 sm:gap-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="rounded-lg xs:rounded-xl border border-border bg-background p-2.5 xs:p-3 sm:p-4 animate-fade-in"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">
                {stat.label}
              </p>
              <p className="text-lg xs:text-xl sm:text-2xl lg:text-3xl font-bold font-mono mt-0.5 xs:mt-1 text-foreground break-words">
                {stat.value}
              </p>
            </div>
            <stat.icon className="h-4 xs:h-5 w-4 xs:w-5 text-muted-foreground flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}
