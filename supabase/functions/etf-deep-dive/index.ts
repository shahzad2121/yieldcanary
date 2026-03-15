import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FMP_BASE_URL = "https://financialmodelingprep.com/stable";

type PricePoint = {
  date: string;
  close: number | null;
  volume: number | null;
};

type DividendEvent = {
  declarationDate: string | null;
  exDate: string | null;
  recordDate: string | null;
  paymentDate: string | null;
  amount: number;
};

type HoldingItem = {
  symbol: string | null;
  name: string | null;
  weight: number | null;
  sector: string | null;
};

type SectorWeight = {
  sector: string;
  weight: number;
};

type EtfDeepDiveResponse = {
  success: true;
  ticker: string;
  prices: PricePoint[];
  dividends: DividendEvent[];
  holdings: HoldingItem[];
  sectors: SectorWeight[];
} | {
  success: false;
  error: string;
};

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, X-Client-Info",
    "Content-Type": "application/json",
  };
}

async function fetchFmp(endpoint: string, apiKey: string, params: Record<string, string> = {}) {
  const url = new URL(`${FMP_BASE_URL}/${endpoint}`);
  url.searchParams.set("apikey", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`FMP error ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function getPriceHistory(ticker: string, apiKey: string): Promise<PricePoint[]> {
  try {
    const data = await fetchFmp("historical-price-eod/full", apiKey, {
      symbol: ticker,
      // Limit to ~5 years of history
      serietype: "line",
    });

    if (!Array.isArray(data)) return [];

    return data.map((row: any) => ({
      date: typeof row.date === "string" ? row.date : null,
      close: typeof row.close === "number" ? row.close : null,
      volume: typeof row.volume === "number" ? row.volume : null,
    })).filter((p: PricePoint) => p.date !== null);
  } catch (_err) {
    return [];
  }
}

async function getDividends(ticker: string, apiKey: string): Promise<DividendEvent[]> {
  try {
    const data = await fetchFmp("dividends", apiKey, {
      symbol: ticker,
    });

    if (!Array.isArray(data)) return [];

    return data.map((row: any) => ({
      declarationDate: typeof row.declarationDate === "string" ? row.declarationDate : null,
      exDate: typeof row.exDividendDate === "string" ? row.exDividendDate : (typeof row.date === "string" ? row.date : null),
      recordDate: typeof row.recordDate === "string" ? row.recordDate : null,
      paymentDate: typeof row.paymentDate === "string" ? row.paymentDate : null,
      amount: typeof row.adjDividend === "number"
        ? row.adjDividend
        : (typeof row.dividend === "number" ? row.dividend : 0),
    })).filter((d: DividendEvent) => d.amount !== 0);
  } catch (_err) {
    return [];
  }
}

async function getHoldings(ticker: string, apiKey: string): Promise<HoldingItem[]> {
  try {
    const data = await fetchFmp("etf/holdings", apiKey, {
      symbol: ticker,
    });

    if (!Array.isArray(data)) return [];

    return data.map((row: any) => ({
      symbol: typeof row.asset === "string" ? row.asset : (typeof row.symbol === "string" ? row.symbol : null),
      name: typeof row.name === "string" ? row.name : null,
      weight: typeof row.weightPercentage === "number" ? row.weightPercentage : null,
      sector: typeof row.sector === "string" ? row.sector : null,
    }));
  } catch (_err) {
    return [];
  }
}

async function getSectorWeights(ticker: string, apiKey: string): Promise<SectorWeight[]> {
  try {
    const data = await fetchFmp("etf/sector-weightings", apiKey, {
      symbol: ticker,
    });

    if (!Array.isArray(data)) return [];

    return data.map((row: any) => ({
      sector: typeof row.sector === "string" ? row.sector : "Unknown",
      weight: typeof row.weightPercentage === "number" ? row.weightPercentage : 0,
    }));
  } catch (_err) {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    const body: EtfDeepDiveResponse = {
      success: false,
      error: "Method not allowed",
    };
    return new Response(JSON.stringify(body), { status: 405, headers: corsHeaders() });
  }

  const fmpApiKey = Deno.env.get("FMP_API_KEY") ?? "";
  if (!fmpApiKey) {
    const body: EtfDeepDiveResponse = {
      success: false,
      error: "FMP_API_KEY is not configured",
    };
    return new Response(JSON.stringify(body), { status: 500, headers: corsHeaders() });
  }

  let ticker: string | null = null;

  if (req.method === "GET") {
    const url = new URL(req.url);
    ticker = url.searchParams.get("ticker");
  } else if (req.method === "POST") {
    try {
      const json = await req.json();
      if (json && typeof json.ticker === "string") {
        ticker = json.ticker;
      }
    } catch (_err) {
      // ignore
    }
  }

  if (!ticker) {
    const body: EtfDeepDiveResponse = {
      success: false,
      error: "Missing ticker",
    };
    return new Response(JSON.stringify(body), { status: 400, headers: corsHeaders() });
  }

  try {
    const [prices, dividends, holdings, sectors] = await Promise.all([
      getPriceHistory(ticker, fmpApiKey),
      getDividends(ticker, fmpApiKey),
      getHoldings(ticker, fmpApiKey),
      getSectorWeights(ticker, fmpApiKey),
    ]);

    const body: EtfDeepDiveResponse = {
      success: true,
      ticker,
      prices,
      dividends,
      holdings,
      sectors,
    };

    return new Response(JSON.stringify(body), { status: 200, headers: corsHeaders() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const body: EtfDeepDiveResponse = {
      success: false,
      error: message,
    };
    return new Response(JSON.stringify(body), { status: 500, headers: corsHeaders() });
  }
});

