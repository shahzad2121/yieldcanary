import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMarketSnapshot, type MarketSnapshotItem } from '@/hooks/useMarketSnapshot';
import { getMarketSnapshotStatus } from '@/lib/marketSnapshotStatus';
import { MarketSnapshotStatusIcon } from '@/components/insights/MarketSnapshotStatusIcon';

function formatPrice(price: number | null, symbol: string): string {
  if (price === null || price === undefined) return '—';
  if (symbol === '^VIX') return price.toFixed(2);
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toFixed(4);
}

function formatChange(pct: number | null): string {
  if (pct === null || pct === undefined) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function SnapshotCard({ item }: { item: MarketSnapshotItem }) {
  const isPositive = (item.changesPercentage ?? 0) >= 0;
  const hasChange = item.changesPercentage !== null && item.changesPercentage !== undefined;
  const status = getMarketSnapshotStatus(item.symbol, item.changesPercentage);

  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-1 sm:gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate flex-1 min-w-0">
            {item.displayName}
          </p>
          {status && (
            <MarketSnapshotStatusIcon status={status} className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
          )}
        </div>
        <p className="text-lg sm:text-xl font-bold font-mono text-foreground mt-1">
          {formatPrice(item.price, item.symbol)}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          {hasChange ? (
            <>
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
              )}
              <span
                className={`text-sm font-medium font-mono ${
                  isPositive ? 'text-primary' : 'text-destructive'
                }`}
              >
                {formatChange(item.changesPercentage)}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MarketSnapshotBanner() {
  const { data, isLoading, error } = useMarketSnapshot();

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-xl border border-border bg-card shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-6 w-16 mt-1" />
                <Skeleton className="h-4 w-14 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-xl border border-border bg-card shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-6 w-16 mt-1" />
                <Skeleton className="h-4 w-14 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground">Market data temporarily unavailable.</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Please try again later.'}
        </p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground">No market data available.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {/* <h2 className="text-lg font-semibold text-foreground">Market Snapshot</h2> */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {data.map((item) => (
          <SnapshotCard key={item.symbol} item={item} />
        ))}
      </div>
    </section>
  );
}
