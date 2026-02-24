import { useMemo } from 'react';
import {
  InsightsListCard,
  type InsightsListColumn,
} from '@/components/insights/InsightsListCard';
import type { ETF } from '@/types/etf';
import { useWeeklyMovers, type WeeklyMover } from '@/hooks/useWeeklyMovers';

interface WeeklyDeteriorationsCardProps {
  plan: 'free' | 'basic' | 'advanced';
  onUpgrade: () => void;
}

type Row = WeeklyMover & {
  id: string;
};

function formatDelta(value: number, suffix: string): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value).toFixed(2);
  return `${sign}${abs}${suffix}`;
}

export function WeeklyDeteriorationsCard({
  plan,
  onUpgrade,
}: WeeklyDeteriorationsCardProps) {
  const { data, isLoading, error } = useWeeklyMovers();

  const rows: Row[] = useMemo(() => {
    if (!data || data.status !== 'ok') return [];
    return data.losers.map((mover) => ({
      ...mover,
      id: mover.ticker,
    }));
  }, [data]);

  const columns: InsightsListColumn[] = useMemo(
    () => [
      {
        id: 'ticker',
        label: 'Ticker',
        width: 'w-[80px]',
        format: (row: ETF | (Row & Partial<ETF>)) =>
          (row as Row).ticker ?? '—',
        cellClassName: 'font-mono font-medium',
      },
      {
        id: 'rocChange',
        label: 'ROC Change',
        width: 'w-[110px]',
        align: 'right',
        format: (row: ETF | (Row & Partial<ETF>)) =>
          formatDelta((row as Row).rocChange, '%'),
        cellClassName: 'font-mono text-sm',
        getValueClassName: (row: ETF | (Row & Partial<ETF>)) => {
          const value = (row as Row).rocChange;
          // ROC: negative = improvement (green), positive = worsening (red)
          return value < 0 ? 'text-emerald-500' : value > 0 ? 'text-red-500' : '';
        },
      },
      {
        id: 'deathClockChange',
        label: 'Death Clock Δ (yrs)',
        width: 'w-[150px]',
        align: 'right',
        format: (row: ETF | (Row & Partial<ETF>)) =>
          formatDelta((row as Row).deathClockChange, 'y'),
        cellClassName: 'font-mono text-sm',
        getValueClassName: (row: ETF | (Row & Partial<ETF>)) => {
          const value = (row as Row).deathClockChange;
          // Death Clock: positive = improvement (green), negative = worsening (red)
          return value > 0 ? 'text-emerald-500' : value < 0 ? 'text-red-500' : '';
        },
      },
      {
        id: 'trueIncomeChange',
        label: 'True Income Δ',
        width: 'w-[130px]',
        align: 'right',
        format: (row: ETF | (Row & Partial<ETF>)) =>
          formatDelta((row as Row).trueIncomeChange, '%'),
        cellClassName: 'font-mono text-sm',
        getValueClassName: (row: ETF | (Row & Partial<ETF>)) => {
          const value = (row as Row).trueIncomeChange;
          // True Income: positive = improvement (green), negative = worsening (red)
          return value > 0 ? 'text-emerald-500' : value < 0 ? 'text-red-500' : '';
        },
      },
    ],
    []
  );

  const emptyMessage =
    data?.status === 'insufficient_history'
      ? 'Weekly movers will appear once we have at least two weeks of snapshot history.'
      : error
      ? 'Unable to load weekly movers right now.'
      : 'No significant weekly deteriorations this week.';

  return (
    <InsightsListCard
      title="Biggest Deteriorations of the Week"
      subtitle="Top 5 ETFs with worsening ROC, Death Clock, and True Income vs last week."
      list={rows as unknown as ETF[]}
      emptyMessage={emptyMessage}
      plan={plan}
      onUpgrade={onUpgrade}
      loading={isLoading}
      columns={columns}
    />
  );
}

