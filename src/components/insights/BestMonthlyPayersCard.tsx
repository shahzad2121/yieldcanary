import { useMemo } from 'react';
import { ETF } from '@/types/etf';
import {
  InsightsListCard,
  type InsightsListColumn,
} from '@/components/insights/InsightsListCard';
import { useUserTaxRate } from '@/hooks/useUserTaxRate';
import { calcMonthlySpendableCashYield } from '@/lib/utils';

const TOP_N = 10;
const DEFAULT_TAX_RATE = 20;

interface BestMonthlyPayersCardProps {
  etfs: ETF[];
  plan: 'free' | 'basic' | 'advanced';
  onUpgrade: () => void;
  loading?: boolean;
}

export function BestMonthlyPayersCard({
  etfs,
  plan,
  onUpgrade,
  loading = false,
}: BestMonthlyPayersCardProps) {
  const { taxRate } = useUserTaxRate();
  const effectiveTaxRate = taxRate ?? DEFAULT_TAX_RATE;

  const list = useMemo(() => {
    const enriched = etfs.map((etf) => {
      const monthlySpendableCashYield = calcMonthlySpendableCashYield({
        lastMonthDistribution: etf.lastMonthDistribution,
        currentPrice: etf.latestAdjClose,
        taxRate: effectiveTaxRate,
      });
      return {
        ...etf,
        monthlySpendableCashYield,
      };
    });

    const filtered = enriched.filter(
      (e) =>
        e.canaryStatus === 'Healthy' && e.payoutFrequency === 'Monthly'
    );
    const sorted = [...filtered].sort((a, b) => {
      const aVal = a.monthlySpendableCashYield ?? -Infinity;
      const bVal = b.monthlySpendableCashYield ?? -Infinity;
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
        id: 'trueIncomeYield',
        label: 'True Income Yield',
        width: 'w-[130px]',
        align: 'right',
        format: (etf) =>
          etf.trueIncomeYield != null ? `${etf.trueIncomeYield.toFixed(2)}%` : 'N/A',
        cellClassName: 'font-mono text-sm',
      },
      {
        id: 'rocPercent',
        label: 'ROC%',
        width: 'w-[80px]',
        align: 'right',
        format: (etf) =>
          etf.rocPercent != null ? `${etf.rocPercent.toFixed(2)}%` : 'N/A',
        cellClassName: 'font-mono text-sm',
      },
      {
        id: 'monthlySpendableCashYield',
        label: 'Monthly Spendable Cash Yield',
        width: 'w-[160px]',
        align: 'right',
        format: (etf) => {
          const val = (etf as ETF & { monthlySpendableCashYield?: number | null })
            .monthlySpendableCashYield;
          return val != null ? `${val.toFixed(2)}%` : 'N/A';
        },
        cellClassName: 'font-mono text-sm',
      },
    ],
    []
  );

  return (
    <InsightsListCard
      title="Best Monthly Payers"
      subtitle="Healthy funds that pay monthly, sorted by Monthly Spendable Cash Yield."
      badge={`Your ${effectiveTaxRate}% Tax Rate Applied`}
      list={list}
      emptyMessage="No Healthy monthly payers left now."
      plan={plan}
      onUpgrade={onUpgrade}
      loading={loading}
      columns={columns}
    />
  );
}
