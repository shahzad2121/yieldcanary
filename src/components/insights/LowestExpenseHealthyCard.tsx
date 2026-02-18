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

interface LowestExpenseHealthyCardProps {
  etfs: ETF[];
  plan: 'free' | 'basic' | 'advanced';
  onUpgrade: () => void;
  loading?: boolean;
}

export function LowestExpenseHealthyCard({
  etfs,
  plan,
  onUpgrade,
  loading = false,
}: LowestExpenseHealthyCardProps) {
  const list = useMemo(() => {
    const filtered = etfs.filter(
      (e) =>
        e.canaryStatus === 'Healthy' &&
        typeof e.expenseRatio === 'number' &&
        e.expenseRatio !== null
    );

    const sorted = [...filtered].sort((a, b) => {
      const aExp =
        typeof a.expenseRatio === 'number' && !Number.isNaN(a.expenseRatio)
          ? a.expenseRatio
          : Number.POSITIVE_INFINITY;
      const bExp =
        typeof b.expenseRatio === 'number' && !Number.isNaN(b.expenseRatio)
          ? b.expenseRatio
          : Number.POSITIVE_INFINITY;

      if (aExp !== bExp) return aExp - bExp; // lowest first
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
      {
        id: 'trueIncomeYield',
        label: 'True Income Yield',
        width: 'w-[80px]',
        align: 'right',
        format: (etf) => formatPercent(etf.trueIncomeYield),
        cellClassName: 'font-mono text-sm whitespace-nowrap',
      },
      {
        id: 'aum',
        label: 'AUM',
        width: 'w-[60px]',
        align: 'right',
        format: (etf) => formatCurrencyInBillions(etf.aum),
        cellClassName: 'font-mono text-sm whitespace-nowrap',
      },
    ],
    []
  );

  return (
    <InsightsListCard
      title="Lowest Expense Ratio Funds (Healthy Only)"
      subtitle="Top 10 Healthy funds with the lowest fees. Lower expenses mean more of the yield goes to you."
      list={list}
      emptyMessage="No Healthy ETFs with expense ratio data left now."
      plan={plan}
      onUpgrade={onUpgrade}
      loading={loading}
      columns={columns}
    />
  );
}

