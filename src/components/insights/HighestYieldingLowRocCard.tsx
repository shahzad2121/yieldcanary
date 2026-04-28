import { useMemo } from 'react';
import { ETF } from '@/types/etf';
import {
  InsightsListCard,
  type InsightsListColumn,
} from '@/components/insights/InsightsListCard';
import { isHealthyForInsights } from '@/lib/insightsHealth';

const ROC_MIN = 0;
const ROC_MAX = 5;
// Fetch a bit more so "See more" can reveal additional items
const TOP_N = 15;

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const pct = value < 1 ? value * 100 : value;
  return `${pct.toFixed(2)}%`;
}

function isLessThanOneYear(inceptionDate: string): boolean {
  if (!inceptionDate) return false;
  const today = new Date();
  const inception = new Date(inceptionDate);
  const ageInDays =
    (today.getTime() - inception.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays < 365;
}

/** Effective 1Y return: use YTD for new ETFs or when 1Y is missing/zero. */
function getEffectiveReturn1Y(etf: ETF): number | null {
  const value1Y = etf.totalReturn1Y;
  const valueYTD = etf.totalReturnYTD;
  const isNew = isLessThanOneYear(etf.inceptionDate);
  const hasNo1YData =
    value1Y === null || value1Y === undefined || value1Y === 0;
  if (isNew || hasNo1YData) return valueYTD ?? null;
  return value1Y ?? null;
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
  {
    id: 'totalReturn1Y',
    label: 'Total Return 1Y',
    width: 'w-[120px]',
    align: 'left',
    format: (etf) => formatPercent(getEffectiveReturn1Y(etf)),
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
    const filtered = etfs.filter((e) => {
      const effectiveReturn = getEffectiveReturn1Y(e);
      return (
        isHealthyForInsights(e) &&
        typeof e.rocPercent === 'number' &&
        e.rocPercent >= ROC_MIN &&
        e.rocPercent <= ROC_MAX &&
        effectiveReturn != null &&
        effectiveReturn > 0
      );
    });
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
      initialRowsShown={10}
    />
  );
}
