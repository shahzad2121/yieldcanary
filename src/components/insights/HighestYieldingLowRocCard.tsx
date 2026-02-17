import { useMemo } from 'react';
import { ETF } from '@/types/etf';
import {
  InsightsListCard,
  type InsightsListColumn,
} from '@/components/insights/InsightsListCard';

const ROC_MIN = 0;
const ROC_MAX = 5;
const TOP_N = 10;

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const pct = value < 1 ? value * 100 : value;
  return `${pct.toFixed(2)}%`;
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
  },
  {
    id: 'status',
    label: 'Status',
    width: 'w-[100px]',
    type: 'status',
    format: (etf) => etf.canaryStatus,
  },
  {
    id: 'rocPercent',
    label: 'ROC %',
    width: 'w-[80px]',
    align: 'right',
    format: (etf) => `${etf.rocPercent}%`,
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

interface HighestYieldingLowRocCardProps {
  etfs: ETF[];
  plan: 'free' | 'basic' | 'advanced';
  onUpgrade: () => void;
  loading?: boolean;
}

export function HighestYieldingLowRocCard({
  etfs,
  plan,
  onUpgrade,
  loading = false,
}: HighestYieldingLowRocCardProps) {
  const list = useMemo(() => {
    const filtered = etfs.filter(
      (e) =>
        e.canaryStatus === 'Healthy' &&
        typeof e.rocPercent === 'number' &&
        e.rocPercent >= ROC_MIN &&
        e.rocPercent <= ROC_MAX &&
        typeof e.totalReturn1Y === 'number' &&
        e.totalReturn1Y > 0
    );
    const sorted = [...filtered].sort((a, b) => {
      const ay = a.trueIncomeYield ?? -1;
      const by = b.trueIncomeYield ?? -1;
      if (by !== ay) return by - ay;
      return (a.ticker ?? '').localeCompare(b.ticker ?? '');
    });
    return sorted.slice(0, TOP_N);
  }, [etfs]);

  return (
    <InsightsListCard
      title="Highest Yielding ETFs with No NAV Erosion"
      subtitle="Healthy funds with 0–5% ROC and positive 1Y total return, sorted by True Income Yield."
      list={list}
      emptyMessage="No Healthy ETFs with 0–5% ROC and positive 1Y total return right now."
      plan={plan}
      onUpgrade={onUpgrade}
      loading={loading}
      columns={COLUMNS}
    />
  );
}
