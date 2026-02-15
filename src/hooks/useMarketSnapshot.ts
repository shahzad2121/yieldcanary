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
    headers: { 'Content-Type': 'application/json' },
  });

  const json: MarketSnapshotResponse = await response.json();

  if (!response.ok) {
    throw new Error(json.error ?? `Request failed: ${response.status}`);
  }

  if (!json.success || !Array.isArray(json.data)) {
    throw new Error(json.error ?? 'Invalid market snapshot response');
  }

  return json.data;
}

export function useMarketSnapshot() {
  return useQuery({
    queryKey: ['market-snapshot'],
    queryFn: fetchMarketSnapshot,
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });
}
