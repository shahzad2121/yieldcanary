import { useMemo } from 'react';
import { ETF } from '@/types/etf';
import {
  InsightsListCard,
  type InsightsListColumn,
} from '@/components/insights/InsightsListCard';
import { formatCurrencyInBillions } from '@/lib/utils';

const TOP_N = 10;

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const pct = value < 1 ? value * 100 : value;
  return `${pct.toFixed(2)}%`;
}

interface LargestHealthyAumCardProps {
  etfs: ETF[];
  plan: 'free' | 'basic' | 'advanced';
  onUpgrade: () => void;
  loading?: boolean;
}

export function LargestHealthyAumCard({
  etfs,
  plan,
  onUpgrade,
  loading = false,
}: LargestHealthyAumCardProps) {
  const list = useMemo(() => {
    const filtered = etfs.filter(
      (e) =>
        e.canaryStatus === 'Healthy' &&
        typeof e.aum === 'number' &&
        e.aum !== null
    );

    const sorted = [...filtered].sort((a, b) => {
      const aAum =
        typeof a.aum === 'number' && !Number.isNaN(a.aum) ? a.aum : 0;
      const bAum =
        typeof b.aum === 'number' && !Number.isNaN(b.aum) ? b.aum : 0;

      if (bAum !== aAum) return bAum - aAum; // largest first
      return (a.ticker ?? '').localeCompare(b.ticker ?? '');
    });

    return sorted.slice(0, TOP_N);
  }, [etfs]);

  const columns: InsightsListColumn[] = useMemo(
    () => [
      {
        id: 'ticker',
        label: 'Ticker',
        width: 'w-[50px]',
        format: (etf) => etf.ticker,
        cellClassName: 'font-mono font-medium',
      },
      {
        id: 'name',
        label: 'Name',
        width: 'min-w-[150px]',
        format: (etf) => etf.name,
        cellClassName: 'min-w-0 truncate',
        showNameTooltip: true,
        valueClassName: 'text-muted-foreground',
      },
      {
        id: 'aum',
        label: 'AUM',
        width: 'w-[60px]',
        align: 'right',
        format: (etf) => formatCurrencyInBillions(etf.aum),
        cellClassName: 'font-mono text-sm whitespace-nowrap',
      },
      {
        id: 'trueIncomeYield',
        label: 'True Income Yield',
        width: 'w-[80px]',
        align: 'right',
        format: (etf) => formatPercent(etf.trueIncomeYield),
        cellClassName: 'font-mono text-sm whitespace-nowrap',
      },
      {
        id: 'expenseRatio',
        label: 'Expense Ratio',
        width: 'w-[70px]',
        align: 'right',
        format: (etf) =>
          typeof etf.expenseRatio === 'number'
            ? `${etf.expenseRatio.toFixed(2)}%`
            : 'N/A',
        cellClassName: 'font-mono text-sm whitespace-nowrap',
      },
    ],
    []
  );

  return (
    <InsightsListCard
      title="Largest Healthy Funds by AUM"
      subtitle="Top 10 Healthy funds by assets under management. Bigger funds tend to be more liquid and stable."
      list={list}
      emptyMessage="No Healthy ETFs with AUM data left now."
      plan={plan}
      onUpgrade={onUpgrade}
      loading={loading}
      columns={columns}
    />
  );
}

