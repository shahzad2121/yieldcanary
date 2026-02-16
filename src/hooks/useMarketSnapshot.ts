import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MarketSnapshotItem {
  symbol: string;
  displayName: string;
  price: number | null;
  changesPercentage: number | null;
  change: number | null;
  previousClose: number | null;
}

interface MarketSnapshotRow {
  symbol: string;
  price: number | null;
  changes_pct: number | null;
  change: number | null;
  previous_close: number | null;
  captured_at: string;
}

const DISPLAY_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^DJI': 'Dow 30',
  '^IXIC': 'Nasdaq',
  '^RUT': 'Russell 2000',
  'GC=F': 'Gold',
  'SI=F': 'Silver',
  'BTC-USD': 'Bitcoin',
  '^VIX': 'VIX',
};

function toDisplayName(symbol: string): string {
  return DISPLAY_NAMES[symbol] ?? symbol;
}

async function fetchMarketSnapshot(): Promise<MarketSnapshotItem[]> {
  const { data, error } = await supabase
    .from('market_snapshots' as any) // remove "as any" once types are regenerated
    .select('symbol, price, changes_pct, change, previous_close, captured_at')
    .order('captured_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return [];

  const rows = data as MarketSnapshotRow[];

  // Keep only the latest row per symbol
  const latestBySymbol = new Map<string, MarketSnapshotRow>();
  for (const row of rows) {
    if (!latestBySymbol.has(row.symbol)) {
      latestBySymbol.set(row.symbol, row);
    }
  }

  return Array.from(latestBySymbol.values()).map((row) => ({
    symbol: row.symbol,
    displayName: toDisplayName(row.symbol),
    price: row.price,
    changesPercentage: row.changes_pct,
    change: row.change,
    previousClose: row.previous_close,
  }));
}

export function useMarketSnapshot() {
  return useQuery({
    queryKey: ['market-snapshot'],
    queryFn: fetchMarketSnapshot,
    staleTime: 2 * 60 * 1000, // 2 minutes to match your cron
    refetchOnWindowFocus: true,
  });
}