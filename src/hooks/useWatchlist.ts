import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type WatchlistData = {
  userEmail: string | null;
  tickers: string[];
};

export function useWatchlist() {
  const queryClient = useQueryClient();

  // Single source of truth for the user's watchlist
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['watchlist'],
    queryFn: async (): Promise<WatchlistData> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const email = session?.user?.email ?? null;

      if (!email) {
        return { userEmail: null, tickers: [] };
      }

      const { data, error: queryError } = await supabase
        .from('watchlist_items' as any)
        .select('ticker')
        .eq('user_email', email);

      if (queryError) {
        throw queryError;
      }

      const rows = (data as unknown as { ticker: string }[] | null) ?? [];
      const tickers = rows.map((row) => row.ticker);

      return { userEmail: email, tickers };
    },
  });

  const userEmail = data?.userEmail ?? null;
  const watchlistTickers = data?.tickers ?? [];

  const isInWatchlist = useCallback(
    (ticker: string) => watchlistTickers.includes(ticker),
    [watchlistTickers],
  );

  // Optimistic add
  const addMutation = useMutation({
    mutationFn: async (ticker: string) => {
      if (!userEmail) {
        throw new Error('User is not logged in');
      }

      const { error: insertError } = await supabase
        .from('watchlist_items' as any)
        .insert({ user_email: userEmail, ticker });

      if (insertError) {
        throw insertError;
      }

      return ticker;
    },
    onMutate: async (ticker: string) => {
      await queryClient.cancelQueries({ queryKey: ['watchlist'] });

      const previous = queryClient.getQueryData<WatchlistData>(['watchlist']);

      if (previous) {
        const alreadyIn = previous.tickers.includes(ticker);
        if (!alreadyIn) {
          queryClient.setQueryData<WatchlistData>(['watchlist'], {
            ...previous,
            tickers: [...previous.tickers, ticker],
          });
        }
      }

      return { previous };
    },
    onError: (_err, _ticker, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['watchlist'], context.previous);
      }
    },
  });

  // Optimistic remove
  const removeMutation = useMutation({
    mutationFn: async (ticker: string) => {
      if (!userEmail) {
        throw new Error('User is not logged in');
      }

      const { error: deleteError } = await supabase
        .from('watchlist_items' as any)
        .delete()
        .eq('user_email', userEmail)
        .eq('ticker', ticker);

      if (deleteError) {
        throw deleteError;
      }

      return ticker;
    },
    onMutate: async (ticker: string) => {
      await queryClient.cancelQueries({ queryKey: ['watchlist'] });

      const previous = queryClient.getQueryData<WatchlistData>(['watchlist']);

      if (previous) {
        queryClient.setQueryData<WatchlistData>(['watchlist'], {
          ...previous,
          tickers: previous.tickers.filter((t) => t !== ticker),
        });
      }

      return { previous };
    },
    onError: (_err, _ticker, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['watchlist'], context.previous);
      }
    },
  });

  const addToWatchlist = useCallback(
    (ticker: string) => {
      if (!userEmail) return;
      if (isInWatchlist(ticker)) return;
      addMutation.mutate(ticker);
    },
    [addMutation, isInWatchlist, userEmail],
  );

  const removeFromWatchlist = useCallback(
    (ticker: string) => {
      if (!userEmail) return;
      if (!isInWatchlist(ticker)) return;
      removeMutation.mutate(ticker);
    },
    [isInWatchlist, removeMutation, userEmail],
  );

  const loading = isLoading || addMutation.status === 'pending' || removeMutation.status === 'pending';
  const errorMessage =
    error instanceof Error ? error.message : (error as { message?: string } | null)?.message ?? null;

  return {
    userEmail,
    watchlistTickers,
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    loading,
    error: errorMessage,
    refetch,
  };
}



