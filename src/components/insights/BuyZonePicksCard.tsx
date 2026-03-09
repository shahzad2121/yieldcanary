import { useMemo } from 'react';
import { ETF } from '@/types/etf';
import {
  InsightsListCard,
  type InsightsListColumn,
} from '@/components/insights/InsightsListCard';

const TRUE_YIELD_MIN = 10;
// Fetch a bit more so "See more" can reveal additional items
const TOP_N = 15;

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
    id: 'trueIncomeYield',
    label: 'True Yield',
    width: 'w-[100px]',
    align: 'right',
    format: (etf) => formatPercent(etf.trueIncomeYield),
    cellClassName: 'font-mono text-sm',
  },
  {
    id: 'price',
    label: 'Price',
    width: 'w-[80px]',
    align: 'right',
    format: (etf) =>
      etf.latestAdjClose != null ? `$${etf.latestAdjClose.toFixed(2)}` : '—',
    cellClassName: 'font-mono text-sm',
  },
  {
    id: 'priceAvg90d',
    label: '90d Avg',
    width: 'w-[80px]',
    align: 'right',
    format: (etf) =>
      etf.priceAvg90d != null ? `$${etf.priceAvg90d.toFixed(2)}` : '—',
    cellClassName: 'font-mono text-sm text-muted-foreground',
  },
  {
    id: 'discountPct',
    label: 'Discount%',
    width: 'w-[95px]',
    align: 'right',
    format: (etf) => {
      const price = etf.latestAdjClose;
      const avg90 = etf.priceAvg90d;
      if (price == null || avg90 == null || avg90 === 0) return '—';
      const discount = ((avg90 - price) / avg90) * 100;
      return `${discount.toFixed(2)}%`;
    },
    cellClassName: 'font-mono text-sm',
    getValueClassName: (etf) => {
      const price = etf.latestAdjClose;
      const avg90 = etf.priceAvg90d;
      if (price == null || avg90 == null || avg90 === 0) {
        return 'text-muted-foreground';
      }
      return 'text-emerald-500';
    },
  },
];

interface BuyZonePicksCardProps {
  etfs: ETF[];
  plan: 'free' | 'basic' | 'advanced';
  onUpgrade: () => void;
  loading?: boolean;
}

export function BuyZonePicksCard({
  etfs,
  plan,
  onUpgrade,
  loading = false,
}: BuyZonePicksCardProps) {
  const list = useMemo(() => {
    const filtered = etfs.filter((e) => {
      if (e.canaryStatus !== 'Healthy') return false;
      const trueYield = e.trueIncomeYield;
      if (trueYield == null || trueYield <= TRUE_YIELD_MIN) return false;
      const price = e.latestAdjClose;
      const avg90 = e.priceAvg90d;
      if (price == null || avg90 == null) return false;
      return price < avg90;
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
      title="Buy Zone Picks — Undervalued Healthy ETFs"
      subtitle="Healthy (ROC <20%), True Yield >10%, price below 90-day average. Sorted by True Income Yield."
      list={list}
      emptyMessage="No Healthy ETFs with True Yield >10% currently trading below their 90-day average."
      plan={plan}
      onUpgrade={onUpgrade}
      loading={loading}
      columns={COLUMNS}
      initialRowsShown={10}
    />
  );
}
