import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ETF } from '@/types/etf';

// Helper function to transform database row to ETF type
function transformRowToETF(row: any): ETF {
  return {
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
    spentDividendsReturnSinceInception: row.spent_dividends_return_since_inception,
    takeHomeReturn1Y: row.take_home_return_1y,
    takeHomeReturnYTD: row.take_home_return_ytd,
    takeHomeReturnSinceInception: row.take_home_return_inception,
    takeHomeCashReturn1Y: row.take_home_cash_return_1y,
    takeHomeCashReturnYTD: row.take_home_cash_return_ytd,
    takeHomeCashReturnSinceInception: row.take_home_cash_return_since_inception,
  };
}

export function useETFs() {
  const queryClient = useQueryClient();

  // Fetch ETFs using TanStack Query
  const {
    data: etfs = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['etfs'],
    queryFn: async (): Promise<ETF[]> => {
      const { data, error: fetchError } = await supabase
        .from('etfs')
        .select('*')
        .order('updated_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Transform database records to ETF type
      return (data || []).map(transformRowToETF);
    },
    staleTime: Infinity, // Data never goes stale (we update via Realtime)
    gcTime: Infinity, // Keep in cache forever
  });

  // Subscribe to Supabase Realtime for price updates
  useEffect(() => {
    // Only subscribe if we have data
    if (etfs.length === 0) return;

    const channel = supabase
      .channel('etf-prices-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'etfs',
        },
        (payload) => {
          // Silently update the cache when price changes
          // This doesn't trigger loading states - just updates the data
          queryClient.setQueryData<ETF[]>(['etfs'], (oldData) => {
            if (!oldData) return oldData;

            // Find the updated ETF and update only the price fields
            return oldData.map((etf) => {
              if (etf.ticker === payload.new.ticker) {
                // Update only price-related fields, keep everything else
                return {
                  ...etf,
                  latestAdjClose: payload.new.latest_adj_close ?? etf.latestAdjClose,
                  latestDate: payload.new.latest_date ?? etf.latestDate,
                  // Optionally update updated_at if you want to track when it was updated
                };
              }
              return etf;
            });
          });
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [etfs.length, queryClient]);

  return { etfs, loading, error };
}
