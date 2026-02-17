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
    id: 'advertisedYield',
    label: 'Advertised Yield',
    width: 'w-[120px]',
    align: 'left',
    format: (etf) =>
      etf.advertisedYield != null ? `${etf.advertisedYield.toFixed(2)}%` : '—',
    cellClassName: 'font-mono text-sm',
  },
  {
    id: 'trueIncomeYield',
    label: 'True Yield',
    width: 'w-[100px]',
    align: 'left',
    format: (etf) => formatPercent(etf.trueIncomeYield),
    cellClassName: 'font-mono text-sm',
  },
];

interface HighestAdvertisedYieldCardProps {
  etfs: ETF[];
  plan: 'free' | 'basic' | 'advanced';
  onUpgrade: () => void;
  loading?: boolean;
}

export function HighestAdvertisedYieldCard({
  etfs,
  plan,
  onUpgrade,
  loading = false,
}: HighestAdvertisedYieldCardProps) {
  const list = useMemo(() => {
    const filtered = etfs.filter((e) => e.advertisedYield != null);
    const sorted = [...filtered].sort((a, b) => {
      const ay = a.advertisedYield ?? -1;
      const by = b.advertisedYield ?? -1;
      if (by !== ay) return by - ay;
      return (a.ticker ?? '').localeCompare(b.ticker ?? '');
    });
    return sorted.slice(0, TOP_N);
  }, [etfs]);

  return (
    <InsightsListCard
      title="Highest Advertised Yield Funds"
      subtitle="Sorted by Advertised Yield. Compare with True Yield — high advertised yield may not be sustainable."
      badge="True Income Warning"
      list={list}
      emptyMessage="No advertised yield data available."
      plan={plan}
      onUpgrade={onUpgrade}
      loading={loading}
      columns={COLUMNS}
    />
  );
}
