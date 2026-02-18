import { useMemo } from 'react';
import { ETF } from '@/types/etf';
import {
  InsightsListCard,
  type InsightsListColumn,
} from '@/components/insights/InsightsListCard';

const TOP_N = 10;

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const pct = value < 1 ? value * 100 : value;
  return `${pct.toFixed(2)}%`;
}

function getDeathClockYears(deathClock: string | null | undefined): number {
  if (!deathClock || deathClock === 'N/A') return Number.POSITIVE_INFINITY;
  const numeric = parseFloat(deathClock);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

const COLUMNS: InsightsListColumn[] = [
  {
    id: 'ticker',
    label: 'Ticker',
    width: 'w-[80px]',
    format: (etf) => etf.ticker,
    cellClassName: 'font-mono font-medium',
  },
  {
    id: 'name',
    label: 'Name',
    width: 'min-w-[120px]',
    format: (etf) => etf.name,
    cellClassName: 'max-w-[180px] truncate',
    valueClassName: 'text-muted-foreground',
  },
  {
    id: 'status',
    label: 'Status',
    width: 'w-[100px]',
    type: 'status',
    format: (etf) => etf.canaryStatus,
  },
  {
    id: 'deathClock',
    label: 'Death Clock',
    width: 'w-[120px]',
    align: 'right',
    format: (etf) => etf.deathClock,
    cellClassName: 'font-mono text-sm',
  },
  {
    id: 'trueIncomeYield',
    label: 'True Yield',
    width: 'w-[100px]',
    align: 'right',
    format: (etf) => formatPercent(etf.trueIncomeYield),
    cellClassName: 'font-mono text-sm',
  },
];

interface YieldTrapsCardProps {
  etfs: ETF[];
  plan: 'free' | 'basic' | 'advanced';
  onUpgrade: () => void;
  loading?: boolean;
}

export function YieldTrapsCard({
  etfs,
  plan,
  onUpgrade,
  loading = false,
}: YieldTrapsCardProps) {
  const list = useMemo(() => {
    const filtered = etfs.filter(
      (e) => e.canaryStatus === 'Dying' || e.canaryStatus === 'Dead'
    );

    const sorted = [...filtered].sort((a, b) => {
      const aDeath = getDeathClockYears(a.deathClock);
      const bDeath = getDeathClockYears(b.deathClock);

      if (aDeath !== bDeath) return aDeath - bDeath; // shortest first

      // Tie-breaker: sort by ticker symbol
      return (a.ticker ?? '').localeCompare(b.ticker ?? '');
    });

    return sorted.slice(0, TOP_N);
  }, [etfs]);

  return (
    <InsightsListCard
      title="Yield Traps to Avoid"
      subtitle="Dying and Dead funds, sorted by shortest Death Clock (years left)."
      list={list}
      emptyMessage="No Dying or Dead funds right now."
      plan={plan}
      onUpgrade={onUpgrade}
      loading={loading}
      columns={COLUMNS}
    />
  );
}

