export type CanaryStatus = 'Healthy' | 'Watch' | 'High Risk' | 'Severe Risk';
export type PayoutFrequency = 'Weekly' | 'Monthly' | 'Quarterly';

export interface ETF {
  id: string;
  ticker: string;
  name: string;
  issuer: string;
  inceptionDate: string;
  latestAdjClose: number;
  latestDate: string;
  /** 90-day trailing average price (from weekly_data). NULL when insufficient data. Used for Buy Zone: price < 90d avg. */
  priceAvg90d: number | null;
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
  /** Beta vs benchmark from FMP profile. */
  beta: number | null;
  /** Fund strategy/objective from FMP etf/info. */
  description: string | null;
  /** Official fund or issuer URL from FMP etf/info. */
  website: string | null;
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
