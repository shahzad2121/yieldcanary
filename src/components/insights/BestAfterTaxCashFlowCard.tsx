import { useMemo } from 'react';
import { ETF } from '@/types/etf';
import {
  InsightsListCard,
  type InsightsListColumn,
} from '@/components/insights/InsightsListCard';
import { useUserTaxRate } from '@/hooks/useUserTaxRate';
import {
  calcTakeHomeCashReturn1Y,
  calcTakeHomeCashReturnYTD,
} from '@/lib/utils';

const TOP_N = 10;
const DEFAULT_TAX_RATE = 20;

function isLessThanOneYear(inceptionDate: string): boolean {
  if (!inceptionDate) return false;
  const today = new Date();
  const inception = new Date(inceptionDate);
  const ageInDays =
    (today.getTime() - inception.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays < 365;
}

function getSortValue1Y(
  etf: ETF,
  value1Y: number | null,
  valueYTD: number | null
): number {
  const isNew = isLessThanOneYear(etf.inceptionDate);
  const hasNo1YData =
    value1Y === null || value1Y === undefined || value1Y === 0;
  if (isNew) return valueYTD ?? -Infinity;
  if (hasNo1YData) return valueYTD ?? -Infinity;
  return value1Y ?? -Infinity;
}

function formatReturn1Y(
  etf: ETF,
  value1Y: number | null,
  valueYTD: number | null
): string {
  const isNew = isLessThanOneYear(etf.inceptionDate);
  const hasNo1YData =
    value1Y === null || value1Y === undefined || value1Y === 0;
  if (isNew) {
    if (valueYTD === null || valueYTD === undefined) return '0.00% (YTD)';
    return `${valueYTD.toFixed(2)}% (YTD)`;
  }
  if (hasNo1YData) {
    if (valueYTD === null || valueYTD === undefined) return '0.00%';
    return `${valueYTD.toFixed(2)}% (YTD)`;
  }
  return `${(value1Y ?? 0).toFixed(2)}%`;
}

interface BestAfterTaxCashFlowCardProps {
  etfs: ETF[];
  plan: 'free' | 'basic' | 'advanced';
  onUpgrade: () => void;
  loading?: boolean;
}

export function BestAfterTaxCashFlowCard({
  etfs,
  plan,
  onUpgrade,
  loading = false,
}: BestAfterTaxCashFlowCardProps) {
  const { taxRate } = useUserTaxRate();
  const effectiveTaxRate = taxRate ?? DEFAULT_TAX_RATE;

  const list = useMemo(() => {
    const enriched = etfs.map((etf) => {
      const takeHomeCashReturn1Y = calcTakeHomeCashReturn1Y({
        latest_adj_close: etf.latestAdjClose,
        price_1y_ago: etf.price1YAgo ?? undefined,
        dividends_last_12mo: etf.dividendsLast12Mo ?? undefined,
        taxRate: effectiveTaxRate,
      });
      const takeHomeCashReturnYTD = calcTakeHomeCashReturnYTD({
        latest_adj_close: etf.latestAdjClose,
        price_ytd_start: etf.priceYTDStart ?? undefined,
        dividends_ytd: etf.dividendsYTD ?? undefined,
        taxRate: effectiveTaxRate,
      });
      return {
        ...etf,
        takeHomeCashReturn1Y: takeHomeCashReturn1Y ?? etf.takeHomeCashReturn1Y,
        takeHomeCashReturnYTD: takeHomeCashReturnYTD ?? etf.takeHomeCashReturnYTD,
      };
    });

    const filtered = enriched.filter((e) => e.canaryStatus === 'Healthy');
    const sorted = [...filtered].sort((a, b) => {
      const aVal = getSortValue1Y(
        a,
        a.takeHomeCashReturn1Y,
        a.takeHomeCashReturnYTD
      );
      const bVal = getSortValue1Y(
        b,
        b.takeHomeCashReturn1Y,
        b.takeHomeCashReturnYTD
      );
      if (bVal !== aVal) return bVal - aVal;
      return (a.ticker ?? '').localeCompare(b.ticker ?? '');
    });
    return sorted.slice(0, TOP_N);
  }, [etfs, effectiveTaxRate]);

  const columns: InsightsListColumn[] = useMemo(
    () => [
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
        id: 'takeHomeCashReturn1Y',
        label: 'Take-Home Cash Return 1Y',
        width: 'w-[160px]',
        align: 'left',
        format: (etf) =>
          formatReturn1Y(
            etf,
            etf.takeHomeCashReturn1Y,
            etf.takeHomeCashReturnYTD
          ),
        cellClassName: 'font-mono text-sm',
      },
    ],
    []
  );

  return (
    <InsightsListCard
      title="Best After-Tax Cash Flow"
      subtitle="Healthy funds, sorted by Take-Home Cash Return 1Y."
      badge={`At your ${effectiveTaxRate}% rate`}
      list={list}
      emptyMessage="No Healthy ETFs with take-home cash return data right now."
      plan={plan}
      onUpgrade={onUpgrade}
      loading={loading}
      columns={columns}
    />
  );
}
