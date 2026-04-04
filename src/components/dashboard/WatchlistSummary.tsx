import { ETF } from '@/types/etf';
import { calcMonthlySpendableCashYield } from '@/lib/utils';
import { useUserTaxRate } from '@/hooks/useUserTaxRate';
import { cn } from '@/lib/utils';

interface WatchlistSummaryProps {
  etfs: ETF[];
}

/** Score per ETF: Healthy=3, Dying=2, Dead=1. Average to 0–100% for display. */
function getWatchlistHealthPercent(etfs: ETF[]): number | null {
  if (etfs.length === 0) return null;
  const points = etfs.map((e) => (e.canaryStatus === 'Healthy' ? 3 : e.canaryStatus === 'Dying' ? 2 : 1));
  const avg = points.reduce((a, b) => a + b, 0) / points.length;
  return Math.round((avg / 3) * 100);
}

function getHealthBarColor(percent: number): string {
  if (percent >= 80) return 'bg-green-500';
  if (percent >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function WatchlistSummary({ etfs }: WatchlistSummaryProps) {
  const { taxRate } = useUserTaxRate();
  const effectiveTaxRate = taxRate ?? 20;

  if (etfs.length === 0) return null;

  const totalEtfs = etfs.length;
  const healthPercent = getWatchlistHealthPercent(etfs);

  const avgTrueIncomeYield =
    etfs.reduce((sum, e) => sum + (e.trueIncomeYield ?? 0), 0) / etfs.length;
  const avgRoc =
    etfs.reduce((sum, e) => sum + (e.rocPercent ?? 0), 0) / etfs.length;

  const avgTakeHomeCashReturn =
    etfs.reduce((sum, e) => sum + (e.takeHomeCashReturn1Y ?? 0), 0) / etfs.length;

  const monthlyYields = etfs
    .map((e) =>
      calcMonthlySpendableCashYield({
        lastMonthDistribution: e.lastMonthDistribution ?? null,
        currentPrice: e.latestAdjClose ?? null,
        taxRate: effectiveTaxRate,
      })
    )
    .filter((y): y is number => y !== null);
  const avgMonthlySpendable =
    monthlyYields.length > 0
      ? monthlyYields.reduce((a, b) => a + b, 0) / monthlyYields.length
      : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 mb-4 space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Total ETFs: {totalEtfs}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Left column: progress bar + criteria */}
        {healthPercent !== null && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              Your Watchlist Health: {healthPercent}%
            </p>
            <div className="h-4 w-full overflow-hidden rounded-full bg-[#0C141D]">
              <div
                className={cn('h-full rounded-full transition-all', getHealthBarColor(healthPercent))}
                style={{ width: `${Math.min(100, Math.max(0, healthPercent))}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" aria-hidden />
                <span>80–100% — Strong</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 shrink-0" aria-hidden />
                <span>40–79% — Mixed</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" aria-hidden />
                <span>0–39% — At risk</span>
              </span>
            </div>
          </div>
        )}

        {/* Right column: metrics */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
          <div>
            <p className="text-muted-foreground font-medium">Avg. True Income Yield</p>
            <p className="text-lg font-mono font-semibold text-foreground">
              {avgTrueIncomeYield.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground font-medium">Avg. ROC%</p>
            <p className="text-lg font-mono font-semibold text-foreground">
              {avgRoc.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground font-medium">Avg. Take Home Cash Return</p>
            <p className="text-lg font-mono font-semibold text-foreground">
              {avgTakeHomeCashReturn.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground font-medium">Avg. Monthly Spendable Cash Yield</p>
            <p className="text-lg font-mono font-semibold text-foreground">
              {avgMonthlySpendable != null ? `${avgMonthlySpendable.toFixed(2)}%` : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
