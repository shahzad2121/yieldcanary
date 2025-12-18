import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Star,
  Banknote,
  Clock,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { ETF, FREE_UNLOCKED_TICKERS } from '@/types/etf';
import { CanaryStatusBadge } from './CanaryStatusBadge';
import { BlurredCell } from './BlurredCell';
import { useUserTaxRate } from '@/hooks/useUserTaxRate';
import { useWatchlist } from '@/hooks/useWatchlist';
import {
  calcTakeHomeReturn1Y,
  calcTakeHomeReturnYTD,
  calcTakeHomeReturnInception,
  calcTakeHomeCashReturn1Y,
  calcTakeHomeCashReturnYTD,
  calcTakeHomeCashReturnInception,
} from '@/lib/utils';

interface ETFTableProps {
  etfs: ETF[];
  plan: 'free' | 'basic';
  isPaid: boolean;
  onUpgrade: () => void;
}

type SortKey = keyof ETF;
type SortDirection = 'asc' | 'desc';

export function ETFTable({ etfs, plan, isPaid, onUpgrade }: ETFTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('takeHomeCashReturn1Y');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Persistent watchlist (starred ETFs) for the current user
  const {
    watchlistTickers,
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
  } = useWatchlist();

  // Get user tax rate
  const { taxRate } = useUserTaxRate();
  // Debug: Log taxRate
  console.log('User taxRate:', taxRate);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Calculate take-home fields dynamically with user tax rate
  const etfsWithTakeHome = useMemo(() =>
    etfs.map((etf) => {
      const takeHomeCashReturn1Y = calcTakeHomeCashReturn1Y({
        latest_adj_close: etf.latestAdjClose,
        price_1y_ago: etf.price1YAgo,
        dividends_last_12mo: etf.dividendsLast12Mo,
        taxRate,
      });
      // Debug: Log calculation inputs and result
      console.log('ETF', etf.ticker, {
        latestAdjClose: etf.latestAdjClose,
        price1YAgo: etf.price1YAgo,
        dividendsLast12Mo: etf.dividendsLast12Mo,
        taxRate,
        takeHomeCashReturn1Y,
      });
      return {
        ...etf,
        takeHomeReturn1Y: calcTakeHomeReturn1Y({
          latest_adj_close: etf.latestAdjClose,
          price_1y_ago: etf.price1YAgo,
          dividends_last_12mo: etf.dividendsLast12Mo,
          taxRate,
        }),
        takeHomeReturnYTD: calcTakeHomeReturnYTD({
          latest_adj_close: etf.latestAdjClose,
          price_ytd_start: etf.priceYTDStart,
          dividends_ytd: etf.dividendsYTD,
          taxRate,
        }),
        takeHomeReturnSinceInception: calcTakeHomeReturnInception({
          latest_adj_close: etf.latestAdjClose,
          price_at_inception: etf.priceAtInception,
          dividends_since_inception: etf.dividendsSinceInception,
          taxRate,
        }),
        takeHomeCashReturn1Y,
        takeHomeCashReturnYTD: calcTakeHomeCashReturnYTD({
          latest_adj_close: etf.latestAdjClose,
          price_ytd_start: etf.priceYTDStart,
          dividends_ytd: etf.dividendsYTD,
          taxRate,
        }),
        takeHomeCashReturnSinceInception: calcTakeHomeCashReturnInception({
          latest_adj_close: etf.latestAdjClose,
          price_at_inception: etf.priceAtInception,
          dividends_since_inception: etf.dividendsSinceInception,
          taxRate,
        }),
      };
    }),
    [etfs, taxRate]
  );

  // Separate free unlocked ETFs and sort them to always appear first
  const sortedETFs = [...etfsWithTakeHome].sort((a, b) => {
    const aIsFree = FREE_UNLOCKED_TICKERS.includes(a.ticker);
    const bIsFree = FREE_UNLOCKED_TICKERS.includes(b.ticker);
    
    // Free sample ETFs always come first
    if (aIsFree && !bIsFree) return -1;
    if (!aIsFree && bIsFree) return 1;
    
    // Within each group, sort by the selected column
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    
    return 0;
  });

  const toggleWatchlist = (ticker: string) => {
    // Only paid users can maintain a watchlist
    if (!isPaid) {
      onUpgrade();
      return;
    }

    if (isInWatchlist(ticker)) {
      removeFromWatchlist(ticker);
    } else {
      addToWatchlist(ticker);
    }
  };

  const isUnlocked = (ticker: string) => isPaid || FREE_UNLOCKED_TICKERS.includes(ticker);

  const formatPercent = (value: number | null) => {
    if (!value) return '0.00%';
    return `${value.toFixed(2)}%`;
  };
  
  const formatCurrency = (value: number | null) => {
    if (!value) return '$0.00';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
    return `$${value.toFixed(2)}`;
  };

  const escapeCSV = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const handleExportCSV = () => {
    if (!isPaid) {
      onUpgrade();
      return;
    }

    const headers = [
      'Ticker',
      'Name',
      'Canary Status',
      'Death Clock (years)',
      'True Income Yield',
      'Total Return 1Y',
      'Take-Home Cash 1Y',
      'Latest Price',
      'Headline Yield',
      'ROC %',
      'AUM',
      'Expense Ratio',
    ];

    const rows = sortedETFs.map((etf) => [
      etf.ticker,
      etf.name,
      etf.canaryStatus,
      etf.deathClock,
      etf.trueIncomeYield ?? '',
      etf.totalReturn1Y ?? '',
      etf.takeHomeCashReturn1Y ?? '',
      etf.latestAdjClose ?? '',
      etf.headlineYieldTTM ?? '',
      etf.rocPercent ?? '',
      etf.aum ?? '',
      etf.expenseRatio ?? '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(','))
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `yield-canary-etfs-${new Date().toISOString().split('T')[0]}.csv`
    );

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const SortableHeader = ({ 
    label, 
    sortKeyProp, 
    icon: Icon,
    className = '',
    isKiller = false,
  }: { 
    label: string; 
    sortKeyProp: SortKey;
    icon?: typeof ChevronDown;
    className?: string;
    isKiller?: boolean;
  }) => (
    <TableHead 
      className={`cursor-pointer hover:bg-muted transition-colors ${className}`}
      onClick={() => handleSort(sortKeyProp)}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span>{label}</span>
        {sortKey === sortKeyProp && (
          sortDirection === 'asc' 
            ? <ChevronUp className="h-3 w-3" /> 
            : <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Table Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground">
            {sortedETFs.length} ETFs
          </span>
        </div>
        {isPaid && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4"
            onClick={handleExportCSV}
            disabled={!sortedETFs.length}
          >
            <Download className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Export CSV</span>
          </Button>
        )}
      </div>

      {/* Desktop Table - Hidden on mobile */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {isPaid && <TableHead className="w-10" />}
                <SortableHeader label="Ticker" sortKeyProp="ticker" />
                <SortableHeader label="Name" sortKeyProp="name" className="min-w-[200px]" />
                <SortableHeader label="Canary Status" sortKeyProp="canaryStatus" isKiller />
                <SortableHeader label="Death Clock" sortKeyProp="deathClock" icon={Clock} isKiller />
                <SortableHeader label="True Income Yield" sortKeyProp="trueIncomeYield" icon={Percent} isKiller />
                <SortableHeader label="Total Return 1Y" sortKeyProp="totalReturn1Y" icon={TrendingUp} isKiller />
                <SortableHeader label="Take-Home Cash Return" sortKeyProp="takeHomeCashReturn1Y" icon={Banknote} className="min-w-[160px]" />
                <SortableHeader label="Price" sortKeyProp="latestAdjClose" />
                <SortableHeader label="Headline Yield" sortKeyProp="headlineYieldTTM" />
                <SortableHeader label="ROC %" sortKeyProp="rocPercent" />
                <SortableHeader label="AUM" sortKeyProp="aum" />
                <SortableHeader label="Expense" sortKeyProp="expenseRatio" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedETFs.map((etf, index) => {
                const unlocked = isUnlocked(etf.ticker);
                return (
                  <TableRow key={etf.id} className="hover:bg-muted/50 transition-colors">
                    {isPaid && (
                      <TableCell>
                        <button
                          onClick={() => toggleWatchlist(etf.ticker)}
                          className="p-1 hover:bg-secondary rounded transition-colors"
                        >
                          <Star className={`h-4 w-4 ${isInWatchlist(etf.ticker) ? 'fill-foreground text-foreground' : 'text-muted-foreground'}`} />
                        </button>
                      </TableCell>
                    )}
                    <TableCell className="font-mono font-semibold text-foreground text-sm">{etf.ticker}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">{etf.name}</TableCell>
                    <TableCell><CanaryStatusBadge status={etf.canaryStatus} /></TableCell>
                    <TableCell className="text-sm"><BlurredCell value={etf.deathClock} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className="text-sm"><BlurredCell value={formatPercent(etf.trueIncomeYield)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className="text-sm"><BlurredCell value={formatPercent(etf.totalReturn1Y)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className="text-sm"><BlurredCell value={formatPercent(etf.takeHomeCashReturn1Y)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className="font-mono text-muted-foreground text-sm">${etf.latestAdjClose ? etf.latestAdjClose.toFixed(2) : '0.00'}</TableCell>
                    <TableCell className="font-mono text-muted-foreground text-sm">{formatPercent(etf.headlineYieldTTM)}</TableCell>
                    <TableCell className="text-sm"><BlurredCell value={`${etf.rocPercent}%`} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className="font-mono text-muted-foreground text-sm">{formatCurrency(etf.aum)}</TableCell>
                    <TableCell className="font-mono text-muted-foreground text-sm">{etf.expenseRatio ? etf.expenseRatio.toFixed(2) : '0.00'}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile Card View - Visible on md and below */}
      <div className="md:hidden space-y-2">
        {sortedETFs.map((etf) => {
          const unlocked = isUnlocked(etf.ticker);
          return (
            <div key={etf.id} className="border border-border rounded-lg p-3 bg-card hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground text-sm">{etf.ticker}</span>
                    <CanaryStatusBadge status={etf.canaryStatus} />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{etf.name}</p>
                </div>
                {isPaid && (
                  <button
                    onClick={() => toggleWatchlist(etf.ticker)}
                    className="p-1 hover:bg-secondary rounded transition-colors ml-2"
                  >
                    <Star className={`h-4 w-4 ${isInWatchlist(etf.ticker) ? 'fill-foreground text-foreground' : 'text-muted-foreground'}`} />
                  </button>
                )}
              </div>

              {/* Key metrics grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Death Clock</p>
                  <BlurredCell value={etf.deathClock} isUnlocked={unlocked} onUpgradeClick={onUpgrade} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Price</p>
                  <p className="font-mono text-sm font-semibold">${etf.latestAdjClose ? etf.latestAdjClose.toFixed(2) : '0.00'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">True Yield</p>
                  <BlurredCell value={formatPercent(etf.trueIncomeYield)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Total Return 1Y</p>
                  <BlurredCell value={formatPercent(etf.totalReturn1Y)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Take-Home Cash Return</p>
                  <BlurredCell value={formatPercent(etf.takeHomeCashReturn1Y)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Headline Yield</p>
                  <p className="font-mono text-sm">{formatPercent(etf.headlineYieldTTM)}</p>
                </div>
              </div>

              {/* Secondary metrics */}
              <div className="text-[11px] text-muted-foreground border-t border-border pt-2 flex gap-4 flex-wrap">
                <div className="flex gap-1">
                  <span>ROC:</span>
                  <BlurredCell value={`${etf.rocPercent}%`} isUnlocked={unlocked} onUpgradeClick={onUpgrade} />
                </div>
                <div className="flex gap-1">
                  <span>AUM:</span>
                  <span className="font-mono">{formatCurrency(etf.aum)}</span>
                </div>
                <div className="flex gap-1">
                  <span>Exp:</span>
                  <span className="font-mono">{etf.expenseRatio ? etf.expenseRatio.toFixed(2) : '0.00'}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Free tier CTA */}
      {plan === 'free' && (
        <div className="text-center py-6 border border-dashed border-primary/30 rounded-xl bg-primary/5">
          <p className="text-muted-foreground mb-3">
            Upgrade to unlock all ETF data, watchlists, alerts, and CSV export
          </p>
          <Button onClick={onUpgrade} className="gap-2 bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-500/90">
            <Banknote className="h-4 w-4" />
            Unlock Full Access
          </Button>
        </div>
      )}
    </div>
  );
}
