import type { CanaryStatus } from '@/types/etf';

/* ─────────────────────────────────────────────
   Individual holding
───────────────────────────────────────────── */
export type PortfolioHolding = {
  ticker: string;
  name: string;
  allocation: number;       // percentage 0–100
  trueIncomeYield: number;  // percentage
  canaryStatus: CanaryStatus;
  deathClock: number | null; // years — null = N/A (Healthy / no erosion detected)
  monthlyIncome: number;    // dollars
  rocPct: number;           // return-of-capital %
};

export const PORTFOLIO_HOLDINGS: PortfolioHolding[] = [
  {
    ticker: 'JEPI',
    name: 'JPMorgan Equity Premium Income ETF',
    allocation: 40,
    trueIncomeYield: 7.2,
    canaryStatus: 'Healthy',
    deathClock: null,
    monthlyIncome: 856,
    rocPct: 3.1,
  },
  {
    ticker: 'QYLD',
    name: 'Global X NASDAQ-100 Covered Call ETF',
    allocation: 25,
    trueIncomeYield: 5.8,
    canaryStatus: 'Dying',
    deathClock: 8.4,
    monthlyIncome: 535,
    rocPct: 22.7,
  },
  {
    ticker: 'SCHD',
    name: 'Schwab US Dividend Equity ETF',
    allocation: 20,
    trueIncomeYield: 3.6,
    canaryStatus: 'Healthy',
    deathClock: null,
    monthlyIncome: 428,
    rocPct: 0.0,
  },
  {
    ticker: 'XYLD',
    name: 'Global X S&P 500 Covered Call ETF',
    allocation: 15,
    trueIncomeYield: 4.9,
    canaryStatus: 'Dying',
    deathClock: 11.2,
    monthlyIncome: 321,
    rocPct: 17.4,
  },
];

/* ─────────────────────────────────────────────
   Portfolio-level summary (derived from above)
───────────────────────────────────────────── */
export const PORTFOLIO_SUMMARY = {
  status: 'Healthy' as CanaryStatus,
  weightedDeathClock: 18.4,   // years
  rocExposure: 12,             // weighted average ROC %
  monthlyCashFlow: 2140,       // sum of monthly income
  totalHoldings: PORTFOLIO_HOLDINGS.length,
} as const;
