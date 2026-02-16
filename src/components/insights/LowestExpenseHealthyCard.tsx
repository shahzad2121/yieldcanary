import { useMemo } from 'react';
import { ETF } from '@/types/etf';
import {
  InsightsListCard,
  type InsightsListColumn,
} from '@/components/insights/InsightsListCard';
import { useUserTaxRate } from '@/hooks/useUserTaxRate';
import {
  calcMonthlySpendableCashYield,
  formatCurrencyInBillions,
} from '@/lib/utils';

const TOP_N = 10;
const DEFAULT_TAX_RATE = 20;

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
        width: 'min-w-[140px]',
        format: (etf) => etf.name,
        cellClassName: 'max-w-[200px] truncate',
      },
      {
        id: 'expenseRatio',
        label: 'Expense Ratio',
        width: 'w-[120px]',
        align: 'right',
        format: (etf) =>
          typeof etf.expenseRatio === 'number'
            ? `${etf.expenseRatio.toFixed(2)}%`
            : 'N/A',
        cellClassName: 'font-mono text-sm',
      },
      {
        id: 'trueIncomeYield',
        label: 'True Income Yield',
        width: 'w-[130px]',
        align: 'right',
        format: (etf) => formatPercent(etf.trueIncomeYield),
        cellClassName: 'font-mono text-sm',
      },
      {
        id: 'monthlySpendableCashYield',
        label: 'Monthly Spendable Cash Yield',
        width: 'w-[170px]',
        align: 'right',
        format: (etf) => {
          const val = (etf as ETF & {
            monthlySpendableCashYield?: number | null;
          }).monthlySpendableCashYield;
          return val != null ? `${val.toFixed(2)}%` : 'N/A';
        },
        cellClassName: 'font-mono text-sm',
      },
      {
        id: 'aum',
        label: 'AUM',
        width: 'w-[110px]',
        align: 'right',
        format: (etf) => formatCurrencyInBillions(etf.aum),
        cellClassName: 'font-mono text-sm',
      },
    ],
    []
  );

  return (
    <InsightsListCard
      title="Lowest Expense Ratio Funds (Healthy Only)"
      subtitle="Top 10 Healthy funds with the lowest fees. Lower expenses mean more of the yield goes to you."
      list={list}
      emptyMessage="No Healthy ETFs with expense ratio data right now."
      plan={plan}
      onUpgrade={onUpgrade}
      loading={loading}
      columns={columns}
    />
  );
}

