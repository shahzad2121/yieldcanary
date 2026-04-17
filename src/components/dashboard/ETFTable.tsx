import { useState, useMemo, type ReactNode } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { DASHBOARD_HEADER_HEIGHT_MOBILE } from './DashboardHeader';
import { useUserTaxRate } from '@/hooks/useUserTaxRate';
import { useWatchlist } from '@/hooks/useWatchlist';
import {
  calcTakeHomeReturn1Y,
  calcTakeHomeReturnYTD,
  calcTakeHomeReturnInception,
  calcTakeHomeCashReturn1Y,
  calcTakeHomeCashReturnYTD,
  calcTakeHomeCashReturnInception,
  calcMonthlySpendableCashYield,
} from '@/lib/utils';
import { EtfTickerChip } from '@/components/etf-deep-dive/EtfTickerChip';

interface ETFTableProps {
  etfs: ETF[];
  plan: 'free' | 'basic' | 'advanced';
  isPaid: boolean;
  onUpgrade: () => void;
  /** Renders left side of the top toolbar (e.g. FilterBar) so filters + Export stay on one row. */
  filterSlot?: ReactNode;
  /** Renders between the toolbar and the table (e.g. compare chip, watchlist summary). */
  belowToolbarSlot?: ReactNode;
}

type SortKey = keyof ETF | 'monthlySpendableCashYield';
type SortDirection = 'asc' | 'desc';

// Default sort configuration - Take-Home Cash Return descending as per client requirement
const DEFAULT_SORT_KEY: SortKey = 'takeHomeCashReturn1Y';
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

// Tooltip explanations for each column
const COLUMN_TOOLTIPS: Record<string, string> = {
  ticker: "The ETF's stock symbol.",
  name: "Full name of the ETF.",
  canaryStatus: "Overall health rating based on destructive Return of Capital (ROC) trends since inception: Healthy (<20% NAV erosion: low risk), Dying (21%-39% NAV erosion: moderate risk), Dead (>40% NAV erosion: severe risk).",
  deathClock: "Estimated years to ~50% NAV erosion at today's destructive ROC rate (N/A for low-risk funds). Recalculated weekly.",
  trueIncomeYield: "Real sustainable yield after subtracting destructive Return of Capital (ROC) from Headline Yield.",
  totalReturn1Y: "Price change over the last 12 months (capital appreciation only).",
  takeHomeCashReturn1Y: "Estimated total return over the last year after taxes on distributions. Includes price change + after-tax payouts (using your personal tax rate from settings, default 20%). Shows what you actually keep in your pocket.",
  monthlySpendableCashYield: "Estimated spendable cash from last month's distribution after taxes — using your personal tax rate from settings, default 20%. Price change not included (unrealized until sold).",
  latestAdjClose: "Current share price. Updates every 2 minutes.",
  headlineYieldTTM: "Trailing 12-month (TTM) yield: total actual distributions paid over the past year divided by current price. Historical and comparable — shows what investors really received.",
  advertisedYield: "Advertised yield: latest payout per share annualized (by payout frequency) divided by current price. May overstate sustainable income — compare with True Income Yield.",
  payoutFrequency: "How often the ETF pays distributions (Weekly, Monthly, Quarterly).",
  rocPercent: "Estimated percentage of recent distributions classified as destructive Return of Capital (eroding principal).",
  aum: "Assets Under Management (total fund size in USD).",
  expenseRatio: "Annual expense ratio (management fees as % of assets).",
};

// Sort keys and labels for mobile dropdown (matches desktop table columns)
const MOBILE_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'name', label: 'Name' },
  { key: 'canaryStatus', label: 'Canary Status' },
  { key: 'deathClock', label: 'Death Clock' },
  { key: 'trueIncomeYield', label: 'True Income Yield' },
  { key: 'totalReturn1Y', label: 'Total Return 1Y' },
  { key: 'takeHomeCashReturn1Y', label: 'Take-Home Cash Return' },
  { key: 'rocPercent', label: 'ROC %' },
  { key: 'headlineYieldTTM', label: 'Headline Yield' },
  { key: 'advertisedYield', label: 'Advertised Yield' },
  { key: 'latestAdjClose', label: 'Price' },
  { key: 'payoutFrequency', label: 'Payout Frequency' },
  { key: 'monthlySpendableCashYield', label: 'Monthly Spendable Cash Yield' },
  { key: 'aum', label: 'AUM' },
  { key: 'expenseRatio', label: 'Expense' },
];

/** Desktop name column width in px — keep in sync with <colgroup> third <col>. */
const ETF_DESKTOP_NAME_COL_PX = 250;

// Column configuration: width and base className for each column
const COLUMN_CONFIG = {
  star: { width: 'w-10', className: '' },
  ticker: { width: 'w-20', className: 'font-mono font-semibold text-center' },
  name: {
    // Must match colgroup third <col> (ETF_DESKTOP_NAME_COL_PX) so sticky + wrapping stay aligned.
    width: 'min-w-[200px] w-[320px] max-w-[320px]',
    className:
      'whitespace-normal break-words [word-break:break-word] leading-snug min-w-0',
  },
  canaryStatus: { width: 'w-32', className: '' },
  deathClock: { width: 'w-28', className: '' },
  trueIncomeYield: { width: 'w-28', className: '' },
  totalReturn1Y: { width: 'w-28', className: '' },
  /** Fixed width like other metric cols — long headers wrap (see SortableHeader). Avoid min-w-* so cols don’t eat horizontal space. */
  takeHomeCashReturn: { width: 'w-28 max-w-[7rem]', className: '' },
  monthlySpendableCashYield: { width: 'w-32 max-w-[8rem]', className: '' },
  price: { width: 'w-24', className: 'font-mono' },
  headlineYield: { width: 'w-28', className: 'font-mono' },
  advertisedYield: { width: 'w-28', className: 'font-mono' },
  payoutFrequency: { width: 'w-32', className: '' },
  rocPercent: { width: 'w-20', className: '' },
  aum: { width: 'max-w-[80px]', className: 'font-mono whitespace-nowrap overflow-hidden' },
  expenseRatio: { width: 'w-24', className: 'font-mono' },
} as const;

/**
 * Sticky offsets must match colgroup widths: 2.5rem + 5rem = 7.5rem (w-10 + w-20).
 * Opaque row hover on sticky cells only — semi-transparent bg lets scrolled cells show through.
 */
const STICKY_STAR_TH =
  'etf-desktop-sticky-star sticky left-0 z-[36] bg-muted';
const STICKY_TICKER_TH =
  'etf-desktop-sticky-ticker sticky left-10 z-[35] bg-muted';
const STICKY_STAR_TD =
  'sticky left-0 z-[5] bg-background group-hover:bg-[#DAE0E6] dark:group-hover:bg-[#202A34]';
const STICKY_TICKER_TD =
  'sticky left-10 z-[6] bg-background group-hover:bg-[#DAE0E6] dark:group-hover:bg-[#202A34]';

export function ETFTable({
  etfs,
  plan,
  isPaid,
  onUpgrade,
  filterSlot,
  belowToolbarSlot,
}: ETFTableProps) {
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

  // Helper function to check if ETF is less than 1 year old
  const isLessThanOneYear = (inceptionDate: string): boolean => {
    if (!inceptionDate) return false;
    const today = new Date();
    const inception = new Date(inceptionDate);
    const ageInDays = (today.getTime() - inception.getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays < 365;
  };

  // Helper function to get sort value for 1Y columns (uses YTD fallback when appropriate)
  // This ensures sorting matches what's displayed
  const getSortValue1Y = (
    etf: any,
    value1Y: number | null,
    valueYTD: number | null
  ): number | null => {
    const isNew = isLessThanOneYear(etf.inceptionDate);
    const hasNo1YData = value1Y === null || value1Y === undefined || value1Y === 0;
    
    // Rule 1: If ETF is less than 1 year old, ALWAYS use YTD (even if 1Y has a value)
    if (isNew) {
      return valueYTD;
    }
    
    // Rule 2: If ETF is older but has no 1Y data, use YTD as fallback
    if (hasNo1YData) {
      return valueYTD;
    }
    
    // Rule 3: For older ETFs with valid 1Y data, use 1Y value
    return value1Y;
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
        monthlySpendableCashYield: calcMonthlySpendableCashYield({
          lastMonthDistribution: etf.lastMonthDistribution,
          currentPrice: etf.latestAdjClose,
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
      // For 1Y columns, use YTD fallback to match display logic
      let aVal: any, bVal: any;
      
      if (sortKey === 'takeHomeCashReturn1Y') {
        // Use YTD fallback for new ETFs or ETFs without 1Y data
        aVal = getSortValue1Y(a, a.takeHomeCashReturn1Y, a.takeHomeCashReturnYTD);
        bVal = getSortValue1Y(b, b.takeHomeCashReturn1Y, b.takeHomeCashReturnYTD);
      } else if (sortKey === 'totalReturn1Y') {
        // Use YTD fallback for new ETFs or ETFs without 1Y data
        aVal = getSortValue1Y(a, a.totalReturn1Y, a.totalReturnYTD);
        bVal = getSortValue1Y(b, b.totalReturn1Y, b.totalReturnYTD);
      } else       if (sortKey === 'monthlySpendableCashYield') {
        aVal = a.monthlySpendableCashYield;
        bVal = b.monthlySpendableCashYield;
      } else if (sortKey === 'advertisedYield') {
        aVal = a.advertisedYield;
        bVal = b.advertisedYield;
      } else {
        aVal = (a as any)[sortKey];
        bVal = (b as any)[sortKey];
      }
      
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
      'ROC %',
      'Headline Yield',
      'Advertised Yield',
      'Latest Price',
      'Payout Frequency',
      'Monthly Spendable Cash Yield',
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
      etf.rocPercent ?? '',
      etf.headlineYieldTTM ?? '',
      etf.advertisedYield != null ? `${etf.advertisedYield.toFixed(2)}%` : '',
      etf.latestAdjClose ?? '',
      etf.payoutFrequency ?? '',
      etf.monthlySpendableCashYield !== null ? `${etf.monthlySpendableCashYield.toFixed(2)}%` : 'N/A',
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
    wrapHeader = false,
  }: {
    label: string;
    sortKeyProp: SortKey;
    icon?: typeof ChevronDown;
    className?: string;
    isKiller?: boolean;
    /** Long labels: wrap in header so column stays narrow (e.g. Take-Home / Monthly yield). */
    wrapHeader?: boolean;
  }) => {
    const tooltipText = COLUMN_TOOLTIPS[sortKeyProp] || '';

    const headerContent = (
      <div
        className={`flex gap-1.5 ${wrapHeader ? 'items-start' : 'items-center'}`}
      >
        {Icon && (
          <Icon
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground ${wrapHeader ? 'mt-0.5' : ''}`}
          />
        )}
        <span className={wrapHeader ? 'whitespace-normal text-left leading-tight' : ''}>
          {label}
        </span>
        {sortKey === sortKeyProp && (
          sortDirection === 'asc' 
            ? <ChevronUp className="h-3 w-3" /> 
            : <ChevronDown className="h-3 w-3" />
        )}
      </div>
    );

    return (
      <TableHead
        className={`cursor-pointer hover:bg-muted transition-colors etf-desktop-header-cell ${wrapHeader ? 'whitespace-normal' : ''} ${className}`}
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

  const exportButton = isPaid ? (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4 shrink-0"
      onClick={handleExportCSV}
      disabled={!sortedETFs.length}
    >
      <Download className="h-3 w-3 sm:h-4 sm:w-4" />
      <span className="hidden xs:inline">Export CSV</span>
    </Button>
  ) : null;

  const defaultViewButton =
    !isPaid && !isDefaultView ? (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs h-7 px-2 shrink-0"
        onClick={handleResetToDefault}
      >
        <RotateCcw className="h-3 w-3" />
        <span>Default View</span>
      </Button>
    ) : null;

  return (
    <div className="">
      {/* Table controls: filters + Default view / Export (gating unchanged: Export only when isPaid) */}
      {filterSlot ? (
        <div className="flex flex-wrap items-center justify-between py-4 gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">{filterSlot}</div>
          <div className="flex shrink-0 items-center gap-2">
            {defaultViewButton}
            {exportButton}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">{defaultViewButton}</div>
          {exportButton}
        </div>
      )}
      {belowToolbarSlot}

      {/* Desktop Table - Hidden on mobile */}
      <div className="hidden md:block rounded-xl border border-border bg-background">
        <TooltipProvider delayDuration={300}>
          <div className="custom-scrollbar etf-desktop-table-scroll">
            <Table className="etf-desktop-data-table border-separate border-spacing-0 w-max">
              <colgroup>
                <col style={{ width: '2.5rem' }} />
                <col style={{ width: '5rem' }} />
                <col style={{ width: `${ETF_DESKTOP_NAME_COL_PX}px` }} />
              </colgroup>
              <TableHeader>
              <TableRow className="bg-muted hover:bg-muted/90">
                <TableHead
                  className={`${COLUMN_CONFIG.star.width} etf-desktop-header-cell etf-desktop-header-cell-first ${STICKY_STAR_TH} pl-2 pr-0`}
                />
                <SortableHeader
                  label="Ticker"
                  className={`${COLUMN_CONFIG.ticker.width} ${STICKY_TICKER_TH} px-0`}
                  sortKeyProp="ticker"
                />
                <SortableHeader
                  label="Name"
                  sortKeyProp="name"
                  className={`${COLUMN_CONFIG.name.width}`}
                />
                <SortableHeader label="Canary Status" sortKeyProp="canaryStatus" className={COLUMN_CONFIG.canaryStatus.width} isKiller />
                <SortableHeader label="Death Clock" sortKeyProp="deathClock" icon={Clock} className={COLUMN_CONFIG.deathClock.width} isKiller />
                <SortableHeader label="True Income Yield" sortKeyProp="trueIncomeYield" icon={Percent} className={COLUMN_CONFIG.trueIncomeYield.width} isKiller />
                <SortableHeader label="Total Return 1Y" sortKeyProp="totalReturn1Y" icon={TrendingUp} className={COLUMN_CONFIG.totalReturn1Y.width} isKiller />
                <SortableHeader
                  label="Take-Home Cash Return"
                  sortKeyProp="takeHomeCashReturn1Y"
                  icon={Banknote}
                  wrapHeader
                  className={`${COLUMN_CONFIG.takeHomeCashReturn.width} text-start`}
                />
                <SortableHeader label="ROC %" sortKeyProp="rocPercent" className={COLUMN_CONFIG.rocPercent.width} />
                <SortableHeader label="Headline Yield" sortKeyProp="headlineYieldTTM" className={COLUMN_CONFIG.headlineYield.width} />
                <SortableHeader label="Advertised Yield" sortKeyProp="advertisedYield" icon={Percent} className={COLUMN_CONFIG.advertisedYield.width} />
                <SortableHeader label="Price" sortKeyProp="latestAdjClose" className={COLUMN_CONFIG.price.width} />
                <SortableHeader label="Payout Frequency" sortKeyProp="payoutFrequency" className={COLUMN_CONFIG.payoutFrequency.width} />
                <SortableHeader
                  label="Monthly Spendable Cash Yield"
                  sortKeyProp="monthlySpendableCashYield"
                  icon={Banknote}
                  wrapHeader
                  className={`${COLUMN_CONFIG.monthlySpendableCashYield.width} text-start`}
                />
                <SortableHeader label="AUM" sortKeyProp="aum" className={COLUMN_CONFIG.aum.width} />
                <SortableHeader label="Expense" sortKeyProp="expenseRatio" className={`${COLUMN_CONFIG.expenseRatio.width} etf-desktop-header-cell-last`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedETFs.map((etf) => {
                const unlocked = isUnlocked(etf.ticker);
                return (
                  <TableRow
                    key={etf.id}
                    className="group hover:bg-[#DAE0E6] dark:hover:bg-[#202A34] transition-colors [&_td]:align-middle"
                  >
                    <TableCell className={`${STICKY_STAR_TD} pl-2 pr-0`}>
                      <button
                        type="button"
                        onClick={() => toggleWatchlist(etf.ticker)}
                        className="p-1 hover:bg-secondary rounded transition-colors"
                      >
                        <Star className={`h-4 w-4 ${isInWatchlist(etf.ticker) ? 'fill-foreground text-foreground' : 'text-muted-foreground'}`} />
                      </button>
                    </TableCell>
                    <TableCell
                      className={`${COLUMN_CONFIG.ticker.width} ${COLUMN_CONFIG.ticker.className} ${STICKY_TICKER_TD} p-0 text-foreground text-sm`}
                    >
                      <EtfTickerChip ticker={etf.ticker} baseEtf={etf} className="mx-auto" />
                    </TableCell>
                    <TableCell
                      className={`${COLUMN_CONFIG.name.width} ${COLUMN_CONFIG.name.className} text-muted-foreground px-1 py-2 text-sm`}
                    >
                      {etf.name}
                    </TableCell>
                    <TableCell className={`${COLUMN_CONFIG.canaryStatus.width} p-0`}><CanaryStatusBadge status={etf.canaryStatus} /></TableCell>
                    <TableCell className={`${COLUMN_CONFIG.deathClock.width} text-sm`}><BlurredCell value={etf.deathClock} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className={`${COLUMN_CONFIG.trueIncomeYield.width} text-sm p-0`}><BlurredCell value={formatPercent(etf.trueIncomeYield)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className={`${COLUMN_CONFIG.totalReturn1Y.width} text-sm`}><BlurredCell value={formatReturn1Y(etf, etf.totalReturn1Y, etf.totalReturnYTD)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className={`${COLUMN_CONFIG.takeHomeCashReturn.width} ${COLUMN_CONFIG.takeHomeCashReturn.className} text-sm`}><BlurredCell value={formatReturn1Y(etf, etf.takeHomeCashReturn1Y, etf.takeHomeCashReturnYTD)} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className={`${COLUMN_CONFIG.rocPercent.width} text-sm`}><BlurredCell value={`${etf.rocPercent}%`} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
                    <TableCell className={`${COLUMN_CONFIG.headlineYield.width} ${COLUMN_CONFIG.headlineYield.className} text-muted-foreground text-sm`}>{formatPercent(etf.headlineYieldTTM)}</TableCell>
                    <TableCell className={`${COLUMN_CONFIG.advertisedYield.width} ${COLUMN_CONFIG.advertisedYield.className} text-muted-foreground text-sm`}>{etf.advertisedYield != null ? `${etf.advertisedYield.toFixed(2)}%` : 'N/A'}</TableCell>
                    <TableCell className={`${COLUMN_CONFIG.price.width} ${COLUMN_CONFIG.price.className} text-muted-foreground text-sm`}>${etf.latestAdjClose ? etf.latestAdjClose.toFixed(2) : '0.00'}</TableCell>
                    <TableCell className={`${COLUMN_CONFIG.payoutFrequency.width} text-sm text-muted-foreground`}>{etf.payoutFrequency || 'N/A'}</TableCell>
                    <TableCell className={`${COLUMN_CONFIG.monthlySpendableCashYield.width} ${COLUMN_CONFIG.monthlySpendableCashYield.className} text-sm`}><BlurredCell value={etf.monthlySpendableCashYield !== null ? `${etf.monthlySpendableCashYield.toFixed(2)}%` : 'N/A'} isUnlocked={unlocked} onUpgradeClick={onUpgrade} /></TableCell>
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
      <div className="md:hidden space-y-4">
        {/* Mobile sorting: dropdown + direction toggle (sticky below header) */}
        <div
          className="sticky z-40 flex items-center gap-2 border-b border-border bg-background py-2"
          style={{ top: DASHBOARD_HEADER_HEIGHT_MOBILE }}
        >
          <Select
            value={sortKey}
            onValueChange={(value) => handleSort(value as SortKey)}
          >
            <SelectTrigger className="flex-1 h-9 text-xs">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              {MOBILE_SORT_OPTIONS.map(({ key, label }) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 shrink-0"
            onClick={() => {
              setIsDefaultView(false);
              setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
            }}
            aria-label={sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            {sortDirection === 'asc' ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          {!isPaid && !isDefaultView && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-9 px-2 shrink-0"
              onClick={handleResetToDefault}
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden xs:inline">Reset</span>
            </Button>
          )}
        </div>

        <div className="space-y-2">
        {sortedETFs.map((etf) => {
          const unlocked = isUnlocked(etf.ticker);
          return (
            <div key={etf.id} className="border border-border rounded-lg p-3 bg-card hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <EtfTickerChip ticker={etf.ticker} baseEtf={etf} />
                    <CanaryStatusBadge status={etf.canaryStatus} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-normal break-words [word-break:break-word] leading-snug">
                    {etf.name}
                  </p>
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
                <div>
                  <p className="text-[10px] text-muted-foreground">Advertised Yield</p>
                  <p className="font-mono text-sm">{etf.advertisedYield != null ? `${etf.advertisedYield.toFixed(2)}%` : 'N/A'}</p>
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
