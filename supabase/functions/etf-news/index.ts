import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FMP_BASE_URL = "https://financialmodelingprep.com/stable";

type NewsItem = {
  symbol: string;
  publishedDate: string;
  publisher: string | null;
  title: string;
  image: string | null;
  site: string | null;
  text: string | null;
  url: string;
};

type EtfNewsResponse =
  | { success: true; ticker: string; news: NewsItem[] }
  | { success: false; error: string };

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, X-Client-Info",
    "Content-Type": "application/json",
  };
}

async function fetchFmpNews(
  ticker: string,
  apiKey: string,
  limit: number = 20,
): Promise<NewsItem[]> {
  const url = new URL(`${FMP_BASE_URL}/news/stock`);
  url.searchParams.set("symbols", ticker);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`FMP news error ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data.map((row: any) => ({
    symbol: typeof row.symbol === "string" ? row.symbol : ticker,
    publishedDate:
      typeof row.publishedDate === "string" ? row.publishedDate : "",
    publisher: typeof row.publisher === "string" ? row.publisher : null,
    title: typeof row.title === "string" ? row.title : "",
    image: typeof row.image === "string" ? row.image : null,
    site: typeof row.site === "string" ? row.site : null,
    text: typeof row.text === "string" ? row.text : null,
    url: typeof row.url === "string" ? row.url : "",
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    const body: EtfNewsResponse = {
      success: false,
      error: "Method not allowed",
    };
    return new Response(JSON.stringify(body), {
      status: 405,
      headers: corsHeaders(),
    });
  }

  const fmpApiKey = Deno.env.get("FMP_API_KEY") ?? "";
  if (!fmpApiKey) {
    const body: EtfNewsResponse = {
      success: false,
      error: "FMP_API_KEY is not configured",
    };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: corsHeaders(),
    });
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
    } catch {
      // ignore bad JSON
    }
  }

  if (!ticker) {
    const body: EtfNewsResponse = {
      success: false,
      error: "Missing ticker",
    };
    return new Response(JSON.stringify(body), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  try {
    const news = await fetchFmpNews(ticker, fmpApiKey, 20);
    const body: EtfNewsResponse = {
      success: true,
      ticker,
      news,
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (err) {
    const body: EtfNewsResponse = {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to fetch news for this ticker",
    };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});

