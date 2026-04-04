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

type EtfDeepDiveResponse =
  | {
      success: true;
      ticker: string;
      prices: PricePoint[];
      dividends: DividendEvent[];
      holdings: HoldingItem[];
      sectors: SectorWeight[];
    }
  | {
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

  console.log("[FMP REQUEST]", endpoint, params);

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });

  if (!response.ok) {
    console.error("[FMP ERROR]", endpoint, response.status, response.statusText);
    throw new Error(`FMP error ${response.status} ${response.statusText}`);
  }

  const json = await response.json();

  console.log("[FMP RESPONSE RECEIVED]", endpoint, Array.isArray(json) ? json.length : "object");

  return json;
}

async function getPriceHistory(ticker: string, apiKey: string): Promise<PricePoint[]> {
  try {
    console.log("[PRICE] Fetching price history for", ticker);

    const data = await fetchFmp("historical-price-eod/full", apiKey, {
      symbol: ticker,
      serietype: "line",
    });

    if (!Array.isArray(data)) {
      console.warn("[PRICE] Unexpected response format");
      return [];
    }

    const result = data
      .map((row: any) => ({
        date: typeof row.date === "string" ? row.date : null,
        close: typeof row.close === "number" ? row.close : null,
        volume: typeof row.volume === "number" ? row.volume : null,
      }))
      .filter((p: PricePoint) => p.date !== null);

    console.log("[PRICE] Processed records:", result.length);

    return result;
  } catch (err) {
    console.error("[PRICE ERROR]", ticker, err);
    return [];
  }
}

async function getDividends(ticker: string, apiKey: string): Promise<DividendEvent[]> {
  try {
    console.log("[DIVIDENDS] Fetching dividends for", ticker);

    const data = await fetchFmp("dividends", apiKey, {
      symbol: ticker,
    });

    if (!Array.isArray(data)) {
      console.warn("[DIVIDENDS] Unexpected response format");
      return [];
    }

    const result = data
      .map((row: any) => ({
        declarationDate: typeof row.declarationDate === "string" ? row.declarationDate : null,
        exDate:
          typeof row.exDividendDate === "string"
            ? row.exDividendDate
            : typeof row.date === "string"
            ? row.date
            : null,
        recordDate: typeof row.recordDate === "string" ? row.recordDate : null,
        paymentDate: typeof row.paymentDate === "string" ? row.paymentDate : null,
        amount:
          typeof row.adjDividend === "number"
            ? row.adjDividend
            : typeof row.dividend === "number"
            ? row.dividend
            : 0,
      }))
      .filter((d: DividendEvent) => d.amount !== 0);

    console.log("[DIVIDENDS] Processed records:", result.length);

    return result;
  } catch (err) {
    console.error("[DIVIDENDS ERROR]", ticker, err);
    return [];
  }
}

async function getHoldings(ticker: string, apiKey: string): Promise<HoldingItem[]> {
  try {
    console.log("[HOLDINGS] Fetching holdings for", ticker);

    const data = await fetchFmp("etf/holdings", apiKey, {
      symbol: ticker,
    });

    if (!Array.isArray(data)) {
      console.warn("[HOLDINGS] Unexpected response format");
      return [];
    }

    console.log("[HOLDINGS] Raw count:", data.length);

    return data.map((row: any) => ({
      symbol:
        typeof row.asset === "string"
          ? row.asset
          : typeof row.symbol === "string"
          ? row.symbol
          : null,
      name: typeof row.name === "string" ? row.name : null,
      weight: typeof row.weightPercentage === "number" ? row.weightPercentage : null,
      sector: typeof row.sector === "string" ? row.sector : null,
    }));
  } catch (err) {
    console.error("[HOLDINGS ERROR]", ticker, err);
    return [];
  }
}

async function getSectorWeights(ticker: string, apiKey: string): Promise<SectorWeight[]> {
  try {
    console.log("[SECTORS] Fetching sector weights for", ticker);

    const data = await fetchFmp("etf/sector-weightings", apiKey, {
      symbol: ticker,
    });

    if (!Array.isArray(data)) {
      console.warn("[SECTORS] Unexpected response format");
      return [];
    }

    console.log("[SECTORS] Raw count:", data.length);

    return data.map((row: any) => ({
      sector: typeof row.sector === "string" ? row.sector : "Unknown",
      weight: typeof row.weightPercentage === "number" ? row.weightPercentage : 0,
    }));
  } catch (err) {
    console.error("[SECTORS ERROR]", ticker, err);
    return [];
  }
}

Deno.serve(async (req) => {
  console.log("[REQUEST RECEIVED]", req.method, req.url);

  if (req.method === "OPTIONS") {
    console.log("[CORS PREFLIGHT]");
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    console.warn("[INVALID METHOD]", req.method);

    const body: EtfDeepDiveResponse = {
      success: false,
      error: "Method not allowed",
    };

    return new Response(JSON.stringify(body), { status: 405, headers: corsHeaders() });
  }

  const fmpApiKey = Deno.env.get("FMP_API_KEY") ?? "";

  if (!fmpApiKey) {
    console.error("[CONFIG ERROR] Missing FMP_API_KEY");

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
    console.log("[GET PARAM]", ticker);
  } else {
    try {
      const json = await req.json();
      ticker = typeof json.ticker === "string" ? json.ticker : null;
      console.log("[POST BODY]", ticker);
    } catch (err) {
      console.warn("[POST PARSE ERROR]", err);
    }
  }

  if (!ticker) {
    console.warn("[VALIDATION ERROR] Missing ticker");

    const body: EtfDeepDiveResponse = {
      success: false,
      error: "Missing ticker",
    };

    return new Response(JSON.stringify(body), { status: 400, headers: corsHeaders() });
  }

  try {
    console.log("[START DATA FETCH]", ticker);

    const [prices, dividends, holdings, sectors] = await Promise.all([
      getPriceHistory(ticker, fmpApiKey),
      getDividends(ticker, fmpApiKey),
      getHoldings(ticker, fmpApiKey),
      getSectorWeights(ticker, fmpApiKey),
    ]);

    console.log("[FETCH COMPLETE]", {
      prices: prices.length,
      dividends: dividends.length,
      holdings: holdings.length,
      sectors: sectors.length,
    });

    const body: EtfDeepDiveResponse = {
      success: true,
      ticker,
      prices,
      dividends,
      holdings,
      sectors,
    };

    console.log("[RESPONSE SUCCESS]", ticker);

    return new Response(JSON.stringify(body), { status: 200, headers: corsHeaders() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    console.error("[SERVER ERROR]", message);

    const body: EtfDeepDiveResponse = {
      success: false,
      error: message,
    };

    return new Response(JSON.stringify(body), { status: 500, headers: corsHeaders() });
  }
});