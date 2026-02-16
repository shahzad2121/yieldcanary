export type CanaryStatus = 'Healthy' | 'Dying' | 'Dead';
export type PayoutFrequency = 'Weekly' | 'Monthly' | 'Quarterly';

export interface ETF {
  id: string;
  ticker: string;
  name: string;
  issuer: string;
  inceptionDate: string;
  latestAdjClose: number;
  latestDate: string;
  /** Price/dividend fields for client-side take-home and return calculations */
  price1YAgo?: number | null;
  dividendsLast12Mo?: number | null;
  priceYTDStart?: number | null;
  dividendsYTD?: number | null;
  priceAtInception?: number | null;
  dividendsSinceInception?: number | null;
  headlineYieldTTM: number;
  /** Advertised yield: (last payout × annualization) / price × 100. NULL when insufficient data. */
  advertisedYield: number | null;
  rocPercent: number;
  rocDate: string;
  trueIncomeYield: number;
  deathClock: string;
  canaryStatus: CanaryStatus;
  aum: number;
  expenseRatio: number;
  payoutFrequency: PayoutFrequency | null;
  
  // Return columns
  totalReturn1Y: number;
  totalReturnYTD: number;
  totalReturnSinceInception: number;
  
  spentDividendsReturn1Y: number;
  spentDividendsReturnYTD: number;
  spentDividendsReturnSinceInception: number;
  
  takeHomeReturn1Y: number;
  takeHomeReturnYTD: number;
  takeHomeReturnSinceInception: number;
  
  takeHomeCashReturn1Y: number;
  takeHomeCashReturnYTD: number;
  takeHomeCashReturnSinceInception: number;
  
  // Monthly distribution data
  lastMonthDistribution: number | null;
}

export interface User {
  id: string;
  email: string;
  taxRate: number;
  isPaid: boolean;
}

// ETFs that are fully unlocked for free users
export const FREE_UNLOCKED_TICKERS = ['TSLY', 'QYLD', 'XYLD', 'MSTY'];
