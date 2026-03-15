import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types (aligned with Insights cards + weekly-movers)
// ---------------------------------------------------------------------------

type EtfRow = {
  id: string;
  ticker: string | null;
  name: string | null;
  canary_health: string | null;
  true_income_yield: number | null;
  latest_adj_close: number | null;
  price_avg_90d: number | null;
  payout_frequency: string | null;
  last_month_distribution: number | null;
  roc_latest: number | null;
};

const TRUE_YIELD_MIN = 10;
const TOP_N = 10;
const DEFAULT_TAX_RATE = 20;

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

function calcMonthlySpendableCashYield(
  lastMonthDistribution: number | null,
  currentPrice: number | null,
  taxRate: number
): number | null {
  if (!lastMonthDistribution || !currentPrice || currentPrice <= 0) return null;
  const afterTax = lastMonthDistribution * (1 - taxRate / 100);
  return round4((afterTax / currentPrice) * 100);
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set"
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// Buy Zone: Healthy, True Yield > 10%, price < 90d avg. Sorted by true yield desc.
function buildBuyZone(rows: EtfRow[]) {
  const filtered = rows.filter((e) => {
    if (e.canary_health !== "Healthy") return false;
    const y = e.true_income_yield;
    if (y == null || y <= TRUE_YIELD_MIN) return false;
    const price = e.latest_adj_close;
    const avg90 = e.price_avg_90d;
    if (price == null || avg90 == null) return false;
    return price < avg90;
  });
  const sorted = [...filtered].sort((a, b) => {
    const ay = a.true_income_yield ?? -1;
    const by = b.true_income_yield ?? -1;
    if (by !== ay) return by - ay;
    return (a.ticker ?? "").localeCompare(b.ticker ?? "");
  });
  return sorted.slice(0, TOP_N).map((e) => {
    const price = e.latest_adj_close;
    const avg90 = e.price_avg_90d;
    const discountPct =
      price != null && avg90 != null && avg90 > 0
        ? ((avg90 - price) / avg90) * 100
        : null;
    return {
      ticker: e.ticker ?? "",
      name: e.name ?? "",
      canaryStatus: e.canary_health ?? "Healthy",
      trueIncomeYield: e.true_income_yield,
      latestAdjClose: e.latest_adj_close,
      priceAvg90d: e.price_avg_90d,
      discountPct: discountPct != null ? round4(discountPct) : null,
    };
  });
}

// Best Monthly Payers: Healthy, payout_frequency === 'Monthly', sorted by monthly spendable cash yield (20% tax).
function buildTopMonthlyPayers(rows: EtfRow[]) {
  const filtered = rows.filter(
    (e) => e.canary_health === "Healthy" && e.payout_frequency === "Monthly"
  );
  const enriched = filtered.map((e) => ({
    ...e,
    monthlySpendableCashYield: calcMonthlySpendableCashYield(
      e.last_month_distribution,
      e.latest_adj_close,
      DEFAULT_TAX_RATE
    ),
  }));
  const sorted = [...enriched].sort((a, b) => {
    const av = a.monthlySpendableCashYield ?? -Infinity;
    const bv = b.monthlySpendableCashYield ?? -Infinity;
    if (bv !== av) return bv - av;
    return (a.ticker ?? "").localeCompare(b.ticker ?? "");
  });
  return sorted.slice(0, TOP_N).map((e) => ({
    ticker: e.ticker ?? "",
    name: e.name ?? "",
    trueIncomeYield: e.true_income_yield,
    monthlySpendableCashYield: e.monthlySpendableCashYield ?? null,
  }));
}

// Best Weekly Payers: Healthy, payout_frequency === 'Weekly', same sort.
function buildTopWeeklyPayers(rows: EtfRow[]) {
  const filtered = rows.filter(
    (e) => e.canary_health === "Healthy" && e.payout_frequency === "Weekly"
  );
  const enriched = filtered.map((e) => ({
    ...e,
    monthlySpendableCashYield: calcMonthlySpendableCashYield(
      e.last_month_distribution,
      e.latest_adj_close,
      DEFAULT_TAX_RATE
    ),
  }));
  const sorted = [...enriched].sort((a, b) => {
    const av = a.monthlySpendableCashYield ?? -Infinity;
    const bv = b.monthlySpendableCashYield ?? -Infinity;
    if (bv !== av) return bv - av;
    return (a.ticker ?? "").localeCompare(b.ticker ?? "");
  });
  return sorted.slice(0, TOP_N).map((e) => ({
    ticker: e.ticker ?? "",
    name: e.name ?? "",
    trueIncomeYield: e.true_income_yield,
    monthlySpendableCashYield: e.monthlySpendableCashYield ?? null,
  }));
}

async function fetchWeeklyMovers(supabaseUrl: string): Promise<{
  status: "ok" | "unavailable";
  currentWeek?: string;
  previousWeek?: string;
  gainers: { ticker: string; rocChange: number; trueIncomeChange: number; score: number; canaryHealth: string | null }[];
  losers: { ticker: string; rocChange: number; trueIncomeChange: number; score: number; canaryHealth: string | null }[];
}> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/weekly-movers`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      return { status: "unavailable", gainers: [], losers: [] };
    }
    const data = await res.json();
    if (!data.success || data.status !== "ok") {
      return {
        status: "unavailable",
        gainers: [],
        losers: [],
      };
    }
    return {
      status: "ok",
      currentWeek: data.currentWeek,
      previousWeek: data.previousWeek,
      gainers: (data.gainers ?? []).map((g: { ticker: string; rocChange: number; trueIncomeChange: number; score: number; canaryHealth?: string | null }) => ({
        ticker: g.ticker,
        rocChange: g.rocChange,
        trueIncomeChange: g.trueIncomeChange,
        score: g.score,
        canaryHealth: g.canaryHealth ?? null,
      })),
      losers: (data.losers ?? []).map((g: { ticker: string; rocChange: number; trueIncomeChange: number; score: number; canaryHealth?: string | null }) => ({
        ticker: g.ticker,
        rocChange: g.rocChange,
        trueIncomeChange: g.trueIncomeChange,
        score: g.score,
        canaryHealth: g.canaryHealth ?? null,
      })),
    };
  } catch {
    return { status: "unavailable", gainers: [], losers: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: corsHeaders() }
    );
  }

  try {
    const supabase = getSupabaseClient();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    const { data: etfRows, error } = await supabase
      .from("etfs")
      .select(
        "id, ticker, name, canary_health, true_income_yield, latest_adj_close, price_avg_90d, payout_frequency, last_month_distribution, roc_latest"
      )
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[get-newsletter-insights] etfs fetch error:", error.message);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: corsHeaders() }
      );
    }

    const rows = ((etfRows ?? []) as EtfRow[]).filter(
      (r) => r.canary_health !== "Unknown"
    );

    const [buyZone, topMonthlyPayers, topWeeklyPayers, weeklyMovers] = await Promise.all([
      Promise.resolve(buildBuyZone(rows)),
      Promise.resolve(buildTopMonthlyPayers(rows)),
      Promise.resolve(buildTopWeeklyPayers(rows)),
      fetchWeeklyMovers(supabaseUrl),
    ]);

    const payload = {
      success: true,
      generatedAt: new Date().toISOString(),
      buyZone,
      topMonthlyPayers,
      topWeeklyPayers,
      weeklyMovers: {
        status: weeklyMovers.status,
        currentWeek: weeklyMovers.currentWeek,
        previousWeek: weeklyMovers.previousWeek,
        gainers: weeklyMovers.gainers,
        losers: weeklyMovers.losers,
      },
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[get-newsletter-insights]", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: corsHeaders() }
    );
  }
});