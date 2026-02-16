import { useQuery } from '@tanstack/react-query';

export interface MarketSnapshotItem {
  symbol: string;
  displayName: string;
  price: number | null;
  changesPercentage: number | null;
  change: number | null;
  previousClose: number | null;
}

interface MarketSnapshotResponse {
  success: boolean;
  data?: MarketSnapshotItem[];
  error?: string;
}

async function fetchMarketSnapshot(): Promise<MarketSnapshotItem[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not set');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/market-snapshot`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch market data' }));
    throw new Error(error.error || `HTTP ${response.status}: Failed to fetch market data`);
  }

  const result: MarketSnapshotResponse = await response.json();
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch market data');
  }

  return result.data;
}

export function useMarketSnapshot() {
  return useQuery({
    queryKey: ['market-snapshot'],
    queryFn: fetchMarketSnapshot,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    refetchInterval: 2 * 60 * 1000, // Auto-refetch every 2 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
    refetchOnMount: true, // Always fetch fresh data on mount
    retry: 2, // Retry failed requests up to 2 times
  });
}