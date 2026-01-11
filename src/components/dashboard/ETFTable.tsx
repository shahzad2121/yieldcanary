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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Star,
  Banknote,
  Clock,
  TrendingUp,
  Percent,
  RotateCcw,
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
  plan: 'free' | 'basic' | 'advanced';
  isPaid: boolean;
  onUpgrade: () => void;
}

type SortKey = keyof ETF;
type SortDirection = 'asc' | 'desc';

// Default sort configuration - Take-Home Cash Return descending as per client requirement
const DEFAULT_SORT_KEY: SortKey = 'takeHomeCashReturn1Y';
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

// Tooltip explanations for each column
const COLUMN_TOOLTIPS: Record<string, string> = {
  ticker: "The ETF's stock symbol.",
  name: "Full name of the ETF.",
  canaryStatus: "Overall health rating based on destructive Return of Capital (ROC) trends: Healthy (low risk), Dying (moderate erosion), Dead (severe erosion).",
  deathClock: "Projected years until ~50% NAV loss at the current rate of destructive ROC (N/A if low/no erosion).",
  trueIncomeYield: "Real sustainable yield after subtracting destructive Return of Capital (ROC) from headline distributions.",
  totalReturn1Y: "Price change over the last 12 months (capital appreciation only).",
  takeHomeCashReturn1Y: "Estimated after-tax cash distributions over the last year. This uses your personal tax rate from settings (default 20%).",
  latestAdjClose: "Current share price.",
  headlineYieldTTM: "Advertised trailing 12-month yield (total distributions ÷ current price) — includes all payouts.",
  payoutFrequency: "How often the ETF pays distributions (Weekly, Monthly, Quarterly).",
  rocPercent: "Estimated percentage of recent distributions classified as destructive Return of Capital (eroding principal).",
  aum: "Assets Under Management (total fund size in USD).",
  expenseRatio: "Annual expense ratio (management fees as % of assets).",
};

// Column configuration: width and base className for each column
const COLUMN_CONFIG = {
  star: { width: 'w-10', className: '' },
  ticker: { width: 'w-20', className: 'font-mono font-semibold text-center' },
  name: { width: 'min-w-[150px] max-w-[200px]', className: 'truncate' },
  canaryStatus: { width: 'w-32', className: '' },
  deathClock: { width: 'w-28', className: '' },
  trueIncomeYield: { width: 'w-32', className: '' },
  totalReturn1Y: { width: 'w-32', className: '' },
  takeHomeCashReturn: { width: 'min-w-[150px]', className: '' },
  price: { width: 'w-24', className: 'font-mono' },
  headlineYield: { width: 'w-28', className: 'font-mono' },
  payoutFrequency: { width: 'w-32', className: '' },
  rocPercent: { width: 'w-20', className: '' },
  aum: { width: 'max-w-[80px]', className: 'font-mono whitespace-nowrap overflow-hidden' },
  expenseRatio: { width: 'w-24', className: 'font-mono' },
} as const;

export function ETFTable({ etfs, plan, isPaid, onUpgrade }: ETFTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION);
  // Default view mode: pins 4 free ETFs at top (only for free users)
  const [isDefaultView, setIsDefaultView] = useState(true);

  // Persistent watchlist (starred ETFs) for the current user
  const {
    watchlistTickers,
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
  } = useWatchlist();

  // Get user tax rate
  const { taxRate } = useUserTaxRate();

  const handleSort = (key: SortKey) => {
    // Exit default view when any header is clicked
    setIsDefaultView(false);
    
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Reset to default view (for free users only)
  const handleResetToDefault = () => {
    setSortKey(DEFAULT_SORT_KEY);
    setSortDirection(DEFAULT_SORT_DIRECTION);
    setIsDefaultView(true);
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

  // Sort ETFs - pin unlocked ETFs at top only in default view for free users
  const sortedETFs = useMemo(() => {
    // Pin 4 free ETFs only when: free user + default view mode active
    const shouldPinFreeETFs = !isPaid && isDefaultView;
    
    return [...etfsWithTakeHome].sort((a, b) => {
      // Only pin free unlocked ETFs at top for free users in default view
      if (shouldPinFreeETFs) {
        const aIsFree = FREE_UNLOCKED_TICKERS.includes(a.ticker);
        const bIsFree = FREE_UNLOCKED_TICKERS.includes(b.ticker);
        
        // Pin free ETFs at top
        if (aIsFree && !bIsFree) return -1;
        if (!aIsFree && bIsFree) return 1;
      }
      
      // Sort ALL ETFs together by the selected column
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      
      // Handle null/undefined values - push them to the end
      if (aVal === null || aVal === undefined) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (bVal === null || bVal === undefined) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      
      // Special sorting for payoutFrequency (Weekly < Monthly < Quarterly)
      if (sortKey === 'payoutFrequency') {
        const frequencyOrder: Record<string, number> = { 'Weekly': 1, 'Monthly': 2, 'Quarterly': 3 };
        const aOrder = frequencyOrder[aVal as string] ?? 999;
        const bOrder = frequencyOrder[bVal as string] ?? 999;
        return sortDirection === 'asc' ? aOrder - bOrder : bOrder - aOrder;
      }
      
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
  }, [etfsWithTakeHome, sortKey, sortDirection, isPaid, isDefaultView]);

  const toggleWatchlist = (ticker: string) => {
    // Watchlist is now available for all users (free and paid)
    if (isInWatchlist(ticker)) {
      removeFromWatchlist(ticker);
    } else {
      addToWatchlist(ticker);
    }
  };

  const isUnlocked = (ticker: string) => isPaid || FREE_UNLOCKED_TICKERS.includes(ticker);

  // Helper function to check if ETF is less than 1 year old
  const isLessThanOneYear = (inceptionDate: string): boolean => {
    if (!inceptionDate) return false;
    const today = new Date();
    const inception = new Date(inceptionDate);
    const ageInDays = (today.getTime() - inception.getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays < 365;
  };

  // Helper function to format 1Y return with YTD fallback for new ETFs
  const formatReturn1Y = (
    etf: typeof etfsWithTakeHome[0],
    value1Y: number | null,
    valueYTD: number | null
  ): string => {
    const isNew = isLessThanOneYear(etf.inceptionDate);
    const hasNo1YData = value1Y === null || value1Y === undefined || value1Y === 0;
    
    // Rule 1: If ETF is less than 1 year old, ALWAYS show YTD (even if 1Y has a value)
    if (isNew) {
      if (valueYTD === null || valueYTD === undefined) return '0.00% (YTD)';
      return `${valueYTD.toFixed(2)}% (YTD)`;
    }
    
    // Rule 2: If ETF is older but has no 1Y data, show YTD as fallback
    if (hasNo1YData) {
      if (valueYTD === null || valueYTD === undefined) return '0.00%';
      return `${valueYTD.toFixed(2)}% (YTD)`;
    }
    
    // Rule 3: For older ETFs with valid 1Y data, show normal 1Y value
    return `${value1Y.toFixed(2)}%`;
  };

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
      'Payout Frequency',
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
      etf.payoutFrequency ?? '',
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
  }) => {
    const tooltipText = COLUMN_TOOLTIPS[sortKeyProp] || '';
    
    const headerContent = (
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span>{label}</span>
        {sortKey === sortKeyProp && (
          sortDirection === 'asc' 
            ? <ChevronUp className="h-3 w-3" /> 
            : <ChevronDown className="h-3 w-3" />
        )}
      </div>
    );

    return (
      <TableHead 
        className={`cursor-pointer hover:bg-muted transition-colors ${className}`}
        onClick={() => handleSort(sortKeyProp)}
      >
        {tooltipText ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {headerContent}
            </TooltipTrigger>
            <TooltipContent 
              side="top" 
              className="max-w-xs text-xs leading-relaxed z-[100]"
              sideOffset={8}
            >
              <p>{tooltipText}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          headerContent
        )}
      </TableHead>
    );
  };

  return (
    <div className="space-y-4">
      {/* Table Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground">
            {sortedETFs.length} ETFs
          </span>
          {/* Default View button - only for free users when not in default view */}
          {!isPaid && !isDefaultView && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 px-2"
              onClick={handleResetToDefault}
            >
              <RotateCcw className="h-3 w-3" />
              <span>Default View</span>
            </Button>
          )}
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
      <div className="hidden md:block rounded-xl border border-border bg-background overflow-hidden">
        <TooltipProvider delayDuration={300}>
          <div className="overflow-x-auto custom-scrollbar">
            <Table className="[&>div>table]:!w-auto">
              <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className={COLUMN_CONFIG.star.width} />
                <SortableHeader label="Ticker" className={COLUMN_CONFIG.ticker.width} sortKeyProp="ticker" />
                <SortableHeader label="Name" sortKeyProp="name" className={COLUMN_CONFIG.name.width} />
                <SortableHeader label="Canary Status" sortKeyProp="canaryStatus" className={COLUMN_CONFIG.canaryStatus.width} isKiller />
                <SortableHeader label="Death Clock" sortKeyProp="deathClock" icon={Clock} className={COLUMN_CONFIG.deathClock.width} isKiller />
                <SortableHeader label="True Income Yield" sortKeyProp="trueIncomeYield" icon={Percent} className={COLUMN_CONFIG.trueIncomeYield.width} isKiller />
                <SortableHeader label="Total Return 1Y" sortKeyProp="totalReturn1Y" icon={TrendingUp} className={COLUMN_CONFIG.totalReturn1Y.width} isKiller />
                <SortableHeader label="Take-Home Cash Return" sortKeyProp="takeHomeCashReturn1Y" icon={Banknote} className={`${COLUMN_CONFIG.takeHomeCashReturn.width} text-start`} />
                <SortableHeader label="Price" sortKeyProp="latestAdjClose" className={COLUMN_CONFIG.price.width} />
                <SortableHeader label="Headline Yield" sortKeyProp="headlineYieldTTM" className={COLUMN_CONFIG.headlineYield.width} />
                <SortableHeader label="Payout Frequency" sortKeyProp="payoutFrequency" className={COLUMN_CONFIG.payoutFrequency.width} />
                <SortableHeader label="ROC %" sortKeyProp="rocPercent" className={COLUMN_CONFIG.rocPercent.width} />
                <SortableHeader label="AUM" sortKeyProp="aum" className={COLUMN_CONFIG.aum.width} />
                <SortableHeader label="Expense" sortKeyProp="expenseRatio" className={COLUMN_CONFIG.expenseRatio.width} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedETFs.map((etf, index) => {
                const unlocked = isUnlocked(etf.ticker);
                return (
                  <TableRow key={etf.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <button
                        onClick={() => toggleWatchlist(etf.ticker)}
                        className="p-1 hover:bg-secondary rounded transition-colors"
                      >
                        <Star className={`h-4 w-4 ${isInWatchlist(etf.ticker) ? 'fill-foreground text-foreground' : 'text-muted-foreground'}`} />
                      </button>
                    </TableCell>
                    <TableCell className={`${COLUMN_CONFIG.ticker.width} ${COLUMN_CONFIG.ticker.className} p-0 text-foreground text-sm`}>{etf.ticker}</TableCell>
                    <TableCell className={`${COLUMN_CONFIG.name.width} ${COLUMN_CONFIG.name.className} text-muted-foreground p-1 text-sm`}>{etf.name}</TableCell>
                    <TableCell className={`${COLUMN_CONFIG.canaryStatus.width} p-0`}><CanaryStatusBadge status={etf.canaryStatus} /></TableCell>
                    <TableCell className={`${COLUMN_CONFIG.deathClock.width} text-sm`}><BlurredCell value={etf.deathClock} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className={`${COLUMN_CONFIG.trueIncomeYield.width} text-sm p-0`}><BlurredCell value={formatPercent(etf.trueIncomeYield)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className={`${COLUMN_CONFIG.totalReturn1Y.width} text-sm`}><BlurredCell value={formatReturn1Y(etf, etf.totalReturn1Y, etf.totalReturnYTD)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className={`${COLUMN_CONFIG.takeHomeCashReturn.width} ${COLUMN_CONFIG.takeHomeCashReturn.className} text-sm`}><BlurredCell value={formatReturn1Y(etf, etf.takeHomeCashReturn1Y, etf.takeHomeCashReturnYTD)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className={`${COLUMN_CONFIG.price.width} ${COLUMN_CONFIG.price.className} text-muted-foreground text-sm`}>${etf.latestAdjClose ? etf.latestAdjClose.toFixed(2) : '0.00'}</TableCell>
                    <TableCell className={`${COLUMN_CONFIG.headlineYield.width} ${COLUMN_CONFIG.headlineYield.className} text-muted-foreground text-sm`}>{formatPercent(etf.headlineYieldTTM)}</TableCell>
                    <TableCell className={`${COLUMN_CONFIG.payoutFrequency.width} text-sm text-muted-foreground`}>{etf.payoutFrequency || 'N/A'}</TableCell>
                    <TableCell className={`${COLUMN_CONFIG.rocPercent.width} text-sm`}><BlurredCell value={`${etf.rocPercent}%`} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className={`${COLUMN_CONFIG.aum.width} ${COLUMN_CONFIG.aum.className} text-muted-foreground text-sm`}>{formatCurrency(etf.aum)}</TableCell>
                    <TableCell className={`${COLUMN_CONFIG.expenseRatio.width} ${COLUMN_CONFIG.expenseRatio.className} text-muted-foreground text-sm`}>{etf.expenseRatio ? etf.expenseRatio.toFixed(2) : '0.00'}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </TooltipProvider>
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
                <button
                  onClick={() => toggleWatchlist(etf.ticker)}
                  className="p-1 hover:bg-secondary rounded transition-colors ml-2"
                >
                  <Star className={`h-4 w-4 ${isInWatchlist(etf.ticker) ? 'fill-foreground text-foreground' : 'text-muted-foreground'}`} />
                </button>
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
                  <BlurredCell value={formatReturn1Y(etf, etf.totalReturn1Y, etf.totalReturnYTD)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Take-Home Cash Return</p>
                  <BlurredCell value={formatReturn1Y(etf, etf.takeHomeCashReturn1Y, etf.takeHomeCashReturnYTD)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Headline Yield</p>
                  <p className="font-mono text-sm">{formatPercent(etf.headlineYieldTTM)}</p>
                </div>
              </div>

              {/* Secondary metrics */}
              <div className="text-[11px] text-muted-foreground border-t border-border pt-2 flex gap-4 flex-wrap">
                <div className="flex gap-1">
                  <span>Payout:</span>
                  <span className="font-mono">{etf.payoutFrequency || 'N/A'}</span>
                </div>
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
            Upgrade to unlock all ETF data, alerts, and CSV export
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
