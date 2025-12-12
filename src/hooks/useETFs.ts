import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ETF } from '@/types/etf';

export function useETFs() {
  const [etfs, setETFs] = useState<ETF[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchETFs = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('etfs')
          .select('*')
          .order('updated_at', { ascending: false });

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        // Transform database records to ETF type
        const transformedETFs: ETF[] = (data || []).map((row: any) => ({
          id: row.id,
          ticker: row.ticker,
          name: row.name,
          issuer: row.issuer,
          inceptionDate: row.inception_date,
          latestAdjClose: row.latest_adj_close,
          latestDate: row.latest_date,
          headlineYieldTTM: row.headline_yield_ttm,
          rocPercent: row.roc_latest,
          rocDate: row.roc_date,
          trueIncomeYield: row.true_income_yield,
          deathClock: row.death_clock_years ? `${row.death_clock_years.toFixed(1)} years` : 'N/A',
          canaryStatus: row.canary_health as 'Healthy' | 'Dying' | 'Dead',
          aum: row.aum,
          expenseRatio: row.expense_ratio,
          // Add all required price/dividend fields for client-side calculations
          price1YAgo: row.price_1y_ago,
          dividendsLast12Mo: row.dividends_last_12mo,
          priceYTDStart: row.price_ytd_start,
          dividendsYTD: row.dividends_ytd,
          priceAtInception: row.price_at_inception,
          dividendsSinceInception: row.dividends_since_inception,
          // Existing return columns
          totalReturn1Y: row.total_return_1y,
          totalReturnYTD: row.total_return_ytd,
          totalReturnSinceInception: row.total_return_inception,
          spentDividendsReturn1Y: row.spent_dividends_return_1y,
          spentDividendsReturnYTD: row.spent_dividends_return_ytd,
          spentDividendsReturnSinceInception: row.spent_dividends_return_inception,
          takeHomeReturn1Y: row.take_home_return_1y,
          takeHomeReturnYTD: row.take_home_return_ytd,
          takeHomeReturnSinceInception: row.take_home_return_inception,
          takeHomeCashReturn1Y: row.take_home_cash_return_1y,
          takeHomeCashReturnYTD: row.take_home_cash_return_ytd,
          takeHomeCashReturnSinceInception: row.take_home_cash_return_inception,
        }));

        setETFs(transformedETFs);
      } catch (err) {
        console.error('Error fetching ETFs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch ETFs');
      } finally {
        setLoading(false);
      }
    };

    fetchETFs();
  }, []);

  return { etfs, loading, error };
}
