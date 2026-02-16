import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Market Snapshot Edge Function
 * Fetches real-time quotes for S&P 500, Dow 30, Nasdaq, Russell 2000, Bitcoin, VIX
 * via FMP API. Called directly from frontend - no database storage needed.
 */

const FMP_BASE_URL = "https://financialmodelingprep.com/stable";

// Display order and optional display names for the frontend
const MARKET_SYMBOLS = [
  "^GSPC",  // S&P 500
  "^DJI",   // Dow 30
  "^IXIC",  // Nasdaq
  "^RUT",   // Russell 2000
  // "GC=F",    //Gold
  //"SI=F",   // Silver
  "BTCUSD", // Bitcoin
  "^VIX",   // VIX
];

const DISPLAY_NAMES: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^DJI": "Dow 30",
  "^IXIC": "Nasdaq",
  "^RUT": "Russell 2000",
  "GC=F": "Gold",
  "SI=F": "Silver",
  "BTCUSD": "Bitcoin",  // Fixed: Changed from "BTC-USD"
  "^VIX": "VIX",
};

type FMPQuote = {
  symbol?: string;
  name?: string;
  price?: number;
  /** FMP returns change as decimal (e.g. 0.03395 for 3.395%) */
  changePercentage?: number;
  change?: number;
  previousClose?: number;
  [key: string]: unknown;
};

export type MarketSnapshotItem = {
  symbol: string;
  displayName: string;
  price: number | null;
  changesPercentage: number | null;
  change: number | null;
  previousClose: number | null;
};

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}

async function fetchMarketQuotes(apiKey: string): Promise<FMPQuote[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const requests = MARKET_SYMBOLS.map(async (symbol) => {
      const url = `${FMP_BASE_URL}/quote?symbol=${encodeURIComponent(
        symbol
      )}&apikey=${encodeURIComponent(apiKey)}`;

      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(
          `FMP API error for ${symbol}: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      // FMP single quote still returns an array
      if (!Array.isArray(data) || data.length === 0) {
        return { symbol };
      }

      return data[0] as FMPQuote;
    });

    return await Promise.all(requests);
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeItem(raw: FMPQuote): MarketSnapshotItem {
  const symbol = raw.symbol ?? "";
  // FMP returns changePercentage as decimal (e.g. 0.03395); convert to percentage (3.395) for frontend
  const changesPercentage =
    typeof raw.changePercentage === "number"
      ? Math.round(raw.changePercentage * 10000) / 100
      : null;
  return {
    symbol,
    displayName: DISPLAY_NAMES[symbol] ?? raw.name ?? symbol,
    price: typeof raw.price === "number" ? raw.price : null,
    changesPercentage,
    change: typeof raw.change === "number" ? raw.change : null,
    previousClose: typeof raw.previousClose === "number" ? raw.previousClose : null,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  // Support both GET and POST for flexibility
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: corsHeaders() }
    );
  }

  const fmpApiKey = Deno.env.get("FMP_API_KEY") ?? "";
  if (!fmpApiKey) {
    console.error("FMP_API_KEY is not set in Supabase Edge Function secrets");
    return new Response(
      JSON.stringify({ success: false, error: "Market data not configured" }),
      { status: 500, headers: corsHeaders() }
    );
  }

  try {
    const rawQuotes = await fetchMarketQuotes(fmpApiKey);
    const bySymbol = new Map<string, FMPQuote>();
    for (const q of rawQuotes) {
      if (q.symbol) bySymbol.set(q.symbol, q);
    }

    const data: MarketSnapshotItem[] = MARKET_SYMBOLS.map((sym) => {
      const raw = bySymbol.get(sym);
      return normalizeItem(raw ?? { symbol: sym });
    });

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch market data";
    console.error("market-snapshot error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 502, headers: corsHeaders() }
    );
  }
});