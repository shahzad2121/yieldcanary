import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Newsletter insights — aligned with Insights page cards (5 rows each)
// ---------------------------------------------------------------------------

const TOP_N = 5;
const TRUE_YIELD_MIN = 10;
const ROC_MIN = 0;
const ROC_MAX = 5;

import type { NewsletterEtfTaxRow } from "../_shared/newsletterTaxCalculations.ts";
import {
  DEFAULT_TAX_RATE,
  buildBestAfterTax as buildBestAfterTaxTaxRows,
  buildTopMonthlyPayers as buildTopMonthlyPayersTaxRows,
  buildTopWeeklyPayers as buildTopWeeklyPayersTaxRows,
} from "../_shared/newsletterTaxCalculations.ts";

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
  advertised_yield: number | null;
  inception_date: string | null;
  total_return_1y: number | null;
  total_return_ytd: number | null;
  aum: number | null;
  expense_ratio: number | null;
  death_clock_years: number | null;
  price_1y_ago: number | null;
  dividends_last_12mo: number | null;
  price_ytd_start: number | null;
  dividends_ytd: number | null;
};

type MarketSnapItem = {
  symbol: string;
  displayName: string;
  price: number | null;
  changesPercentage: number | null;
};

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

function calcMonthlySpendableCashYield(
  lastMonthDistribution: number | null,
  currentPrice: number | null,
  taxRate: number,
): number | null {
  if (!lastMonthDistribution || !currentPrice || currentPrice <= 0) return null;
  const afterTax = lastMonthDistribution * (1 - taxRate / 100);
  return round4((afterTax / currentPrice) * 100);
}

function calcTakeHomeCashReturn1Y(
  latest_adj_close: number | null | undefined,
  price_1y_ago: number | null | undefined,
  dividends_last_12mo: number | null | undefined,
  taxRate: number,
): number | null {
  if (!price_1y_ago || price_1y_ago === 0) return null;
  const afterTaxDiv = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result =
    ((latest_adj_close ?? 0) - (price_1y_ago ?? 0) +
      afterTaxDiv(dividends_last_12mo ?? undefined)) / price_1y_ago;
  return round4(result * 100);
}

function calcTakeHomeCashReturnYTD(
  latest_adj_close: number | null | undefined,
  price_ytd_start: number | null | undefined,
  dividends_ytd: number | null | undefined,
  taxRate: number,
): number | null {
  if (!price_ytd_start || price_ytd_start === 0) return null;
  const afterTaxDiv = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result =
    ((latest_adj_close ?? 0) - (price_ytd_start ?? 0) +
      afterTaxDiv(dividends_ytd ?? undefined)) / price_ytd_start;
  return round4(result * 100);
}

function formatCurrencyInBillions(value: number | null | undefined): string {
  if (value == null || value === 0) return "$0.0 B";
  const billions = value / 1e9;
  return `$${billions.toFixed(1)} B`;
}

function formatPct(value: number | null | undefined): string {
  if (value == null || value === undefined) return "—";
  const pct = value < 1 ? value * 100 : value;
  return `${pct.toFixed(2)}%`;
}

function isLessThanOneYear(inceptionDate: string | null): boolean {
  if (!inceptionDate) return false;
  const today = new Date();
  const inception = new Date(inceptionDate);
  const ageInDays =
    (today.getTime() - inception.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays < 365;
}

function getEffectiveReturn1Y(e: EtfRow): number | null {
  const value1Y = e.total_return_1y;
  const valueYTD = e.total_return_ytd;
  const isNew = isLessThanOneYear(e.inception_date ?? "");
  const hasNo1YData =
    value1Y === null || value1Y === undefined || value1Y === 0;
  if (isNew || hasNo1YData) return valueYTD ?? null;
  return value1Y ?? null;
}

function getSortValueTakeHome(
  e: EtfRow,
  takeHome1Y: number | null,
  takeHomeYTD: number | null,
): number {
  const isNew = isLessThanOneYear(e.inception_date ?? "");
  const hasNo1YData =
    takeHome1Y === null || takeHome1Y === undefined || takeHome1Y === 0;
  if (isNew) return takeHomeYTD ?? -Infinity;
  if (hasNo1YData) return takeHomeYTD ?? -Infinity;
  return takeHome1Y ?? -Infinity;
}

function formatTakeHomeReturnLabel(
  e: EtfRow,
  takeHome1Y: number | null,
  takeHomeYTD: number | null,
): string {
  const isNew = isLessThanOneYear(e.inception_date ?? "");
  const hasNo1YData =
    takeHome1Y === null || takeHome1Y === undefined || takeHome1Y === 0;
  if (isNew) {
    if (takeHomeYTD === null || takeHomeYTD === undefined) return "—";
    return `${takeHomeYTD.toFixed(2)}% (YTD)`;
  }
  if (hasNo1YData) {
    if (takeHomeYTD === null || takeHomeYTD === undefined) return "—";
    return `${takeHomeYTD.toFixed(2)}% (YTD)`;
  }
  return `${(takeHome1Y ?? 0).toFixed(2)}%`;
}

function deathClockLabel(years: number | null | undefined): string {
  if (years == null || !Number.isFinite(years)) return "N/A";
  return `${years.toFixed(1)} years`;
}

function getDeathClockYearsForSort(years: number | null | undefined): number {
  if (years == null || !Number.isFinite(years)) return Number.POSITIVE_INFINITY;
  return years;
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
      "SUPABASE_URL and SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set",
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/** Most recent Friday (UTC) for “week ending” copy when sending the Monday newsletter. */
function getPriorWeekEndingFriday(d: Date): Date {
  const utc = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dow = utc.getUTCDay();
  let offset: number;
  if (dow === 0) offset = 2;
  else if (dow < 5) offset = dow + 2;
  else if (dow === 5) offset = 0;
  else offset = 1;
  utc.setUTCDate(utc.getUTCDate() - offset);
  return utc;
}

function weekEndingNumericUs(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

async function fetchMarketSnapshot(
  supabaseUrl: string,
): Promise<{ status: "ok" | "unavailable"; items: MarketSnapItem[] }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/market-snapshot`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return { status: "unavailable", items: [] };
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) {
      return { status: "unavailable", items: [] };
    }
    const items = (data.data as MarketSnapItem[]).map((x) => ({
      symbol: x.symbol,
      displayName: x.displayName,
      price: x.price,
      changesPercentage: x.changesPercentage,
    }));
    return { status: "ok", items };
  } catch {
    return { status: "unavailable", items: [] };
  }
}

async function fetchWeeklyMovers(supabaseUrl: string): Promise<{
  status: "ok" | "insufficient_history" | "unavailable";
  currentWeek?: string;
  previousWeek?: string;
  gainers: {
    ticker: string;
    rocChange: number;
    deathClockChange: number;
    trueIncomeChange: number;
    score: number;
    canaryHealth: string | null;
  }[];
  losers: {
    ticker: string;
    rocChange: number;
    deathClockChange: number;
    trueIncomeChange: number;
    score: number;
    canaryHealth: string | null;
  }[];
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
    if (!data.success) {
      return { status: "unavailable", gainers: [], losers: [] };
    }
    if (data.status === "insufficient_history") {
      return {
        status: "insufficient_history",
        gainers: [],
        losers: [],
      };
    }
    if (data.status !== "ok") {
      return { status: "unavailable", gainers: [], losers: [] };
    }
    const mapM = (g: Record<string, unknown>) => ({
      ticker: String(g.ticker ?? ""),
      rocChange: Number(g.rocChange ?? 0),
      deathClockChange: Number(g.deathClockChange ?? 0),
      trueIncomeChange: Number(g.trueIncomeChange ?? 0),
      score: Number(g.score ?? 0),
      canaryHealth: (g.canaryHealth as string | null) ?? null,
    });
    return {
      status: "ok",
      currentWeek: data.currentWeek,
      previousWeek: data.previousWeek,
      gainers: (data.gainers ?? []).slice(0, TOP_N).map(mapM),
      losers: (data.losers ?? []).slice(0, TOP_N).map(mapM),
    };
  } catch {
    return { status: "unavailable", gainers: [], losers: [] };
  }
}

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
      canaryStatus: e.canary_health ?? "",
      trueIncomeYield: e.true_income_yield,
      latestAdjClose: e.latest_adj_close,
      priceAvg90d: e.price_avg_90d,
      discountPct: discountPct != null ? round4(discountPct) : null,
    };
  });
}

function buildHighestYieldingLowRoc(rows: EtfRow[]) {
  const filtered = rows.filter((e) => {
    const effectiveReturn = getEffectiveReturn1Y(e);
    return (
      e.canary_health === "Healthy" &&
      typeof e.roc_latest === "number" &&
      e.roc_latest >= ROC_MIN &&
      e.roc_latest <= ROC_MAX &&
      effectiveReturn != null &&
      effectiveReturn > 0
    );
  });
  const sorted = [...filtered].sort((a, b) => {
    const ay = a.true_income_yield ?? -1;
    const by = b.true_income_yield ?? -1;
    if (by !== ay) return by - ay;
    return (a.ticker ?? "").localeCompare(b.ticker ?? "");
  });
  return sorted.slice(0, TOP_N).map((e) => ({
    ticker: e.ticker ?? "",
    name: e.name ?? "",
    canaryStatus: e.canary_health ?? "",
    rocPercent: e.roc_latest,
    trueIncomeYield: e.true_income_yield,
    totalReturn1YDisplay: formatPct(getEffectiveReturn1Y(e)),
  }));
}

function buildHighestAdvertised(rows: EtfRow[]) {
  const filtered = rows.filter((e) => e.advertised_yield != null);
  const sorted = [...filtered].sort((a, b) => {
    const ay = a.advertised_yield ?? -1;
    const by = b.advertised_yield ?? -1;
    if (by !== ay) return by - ay;
    return (a.ticker ?? "").localeCompare(b.ticker ?? "");
  });
  return sorted.slice(0, TOP_N).map((e) => ({
    ticker: e.ticker ?? "",
    name: e.name ?? "",
    advertisedYield: e.advertised_yield,
    trueIncomeYield: e.true_income_yield,
  }));
}

function buildBestAfterTax(rows: EtfRow[], taxRate: number) {
  // Replaced by shared pure helper in `_shared/newsletterTaxCalculations.ts`
  return buildBestAfterTaxTaxRows(rows as unknown as NewsletterEtfTaxRow[], taxRate);
}

function buildTopMonthlyPayers(rows: EtfRow[], taxRate: number) {
  // Replaced by shared pure helper in `_shared/newsletterTaxCalculations.ts`
  return buildTopMonthlyPayersTaxRows(rows as unknown as NewsletterEtfTaxRow[], taxRate);
}

function buildTopWeeklyPayers(rows: EtfRow[], taxRate: number) {
  // Replaced by shared pure helper in `_shared/newsletterTaxCalculations.ts`
  return buildTopWeeklyPayersTaxRows(rows as unknown as NewsletterEtfTaxRow[], taxRate);
}

function buildLargestHealthyAum(rows: EtfRow[]) {
  const filtered = rows.filter(
    (e) =>
      e.canary_health === "Healthy" &&
      typeof e.aum === "number" &&
      e.aum !== null,
  );
  const sorted = [...filtered].sort((a, b) => {
    const aAum = Number.isFinite(a.aum ?? NaN) ? (a.aum as number) : 0;
    const bAum = Number.isFinite(b.aum ?? NaN) ? (b.aum as number) : 0;
    if (bAum !== aAum) return bAum - aAum;
    return (a.ticker ?? "").localeCompare(b.ticker ?? "");
  });
  return sorted.slice(0, TOP_N).map((e) => ({
    ticker: e.ticker ?? "",
    name: e.name ?? "",
    aumDisplay: formatCurrencyInBillions(e.aum),
    trueIncomeYield: e.true_income_yield,
    expenseRatio: e.expense_ratio,
  }));
}

function buildLowestExpense(rows: EtfRow[]) {
  const filtered = rows.filter(
    (e) =>
      e.canary_health === "Healthy" &&
      typeof e.expense_ratio === "number" &&
      e.expense_ratio !== null,
  );
  const sorted = [...filtered].sort((a, b) => {
    const aExp = Number.isFinite(a.expense_ratio ?? NaN)
      ? (a.expense_ratio as number)
      : Number.POSITIVE_INFINITY;
    const bExp = Number.isFinite(b.expense_ratio ?? NaN)
      ? (b.expense_ratio as number)
      : Number.POSITIVE_INFINITY;
    if (aExp !== bExp) return aExp - bExp;
    return (a.ticker ?? "").localeCompare(b.ticker ?? "");
  });
  return sorted.slice(0, TOP_N).map((e) => ({
    ticker: e.ticker ?? "",
    name: e.name ?? "",
    expenseRatio: e.expense_ratio,
    trueIncomeYield: e.true_income_yield,
    aumDisplay: formatCurrencyInBillions(e.aum),
  }));
}

function buildYieldTraps(rows: EtfRow[]) {
  const filtered = rows.filter(
    (e) => e.canary_health === "Dying" || e.canary_health === "Dead",
  );
  const sorted = [...filtered].sort((a, b) => {
    const aDeath = getDeathClockYearsForSort(a.death_clock_years);
    const bDeath = getDeathClockYearsForSort(b.death_clock_years);
    if (aDeath !== bDeath) return aDeath - bDeath;
    return (a.ticker ?? "").localeCompare(b.ticker ?? "");
  });
  return sorted.slice(0, TOP_N).map((e) => ({
    ticker: e.ticker ?? "",
    name: e.name ?? "",
    canaryStatus: e.canary_health ?? "",
    deathClock: deathClockLabel(e.death_clock_years),
    trueIncomeYield: e.true_income_yield,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: corsHeaders() },
    );
  }

  try {
    const supabase = getSupabaseClient();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    const { data: etfRows, error } = await supabase
      .from("etfs")
      .select(
        "id, ticker, name, canary_health, true_income_yield, latest_adj_close, price_avg_90d, payout_frequency, last_month_distribution, roc_latest, advertised_yield, inception_date, total_return_1y, total_return_ytd, aum, expense_ratio, death_clock_years, price_1y_ago, dividends_last_12mo, price_ytd_start, dividends_ytd, updated_at",
      )
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(
        "[get-newsletter-insights] etfs fetch error:",
        error.message,
      );
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: corsHeaders() },
      );
    }

    const rows = ((etfRows ?? []) as EtfRow[]).filter(
      (r) => r.canary_health !== "Unknown",
    );

    const generatedAt = new Date();
    const weekEnding = getPriorWeekEndingFriday(generatedAt);
    const weekEndingLabel = weekEndingNumericUs(weekEnding);

    const taxRate = DEFAULT_TAX_RATE;
    // Provide minimal rows so the send/worker can recompute tax-aware lists per recipient.
    const etfsForTax: NewsletterEtfTaxRow[] = rows.map((r) => ({
      ticker: r.ticker,
      name: r.name,
      canary_health: r.canary_health,
      payout_frequency: r.payout_frequency,
      last_month_distribution: r.last_month_distribution,
      roc_latest: r.roc_latest,
      latest_adj_close: r.latest_adj_close,
      price_1y_ago: r.price_1y_ago,
      dividends_last_12mo: r.dividends_last_12mo,
      inception_date: r.inception_date,
      price_ytd_start: r.price_ytd_start,
      dividends_ytd: r.dividends_ytd,
    }));

    const [
      marketSnapshot,
      weeklyMovers,
      buyZone,
      highestYieldingLowRoc,
      highestAdvertised,
      bestAfterTax,
      bestWeeklyPayers,
      bestMonthlyPayers,
      largestHealthyAum,
      lowestExpenseHealthy,
      yieldTraps,
    ] = await Promise.all([
      fetchMarketSnapshot(supabaseUrl),
      fetchWeeklyMovers(supabaseUrl),
      Promise.resolve(buildBuyZone(rows)),
      Promise.resolve(buildHighestYieldingLowRoc(rows)),
      Promise.resolve(buildHighestAdvertised(rows)),
      Promise.resolve(buildBestAfterTax(rows, taxRate)),
      Promise.resolve(buildTopWeeklyPayers(rows, taxRate)),
      Promise.resolve(buildTopMonthlyPayers(rows, taxRate)),
      Promise.resolve(buildLargestHealthyAum(rows)),
      Promise.resolve(buildLowestExpense(rows)),
      Promise.resolve(buildYieldTraps(rows)),
    ]);

    const payload = {
      success: true,
      generatedAt: generatedAt.toISOString(),
      taxRateDefault: taxRate,
      etfsForTax,
      marketSnapshot: {
        status: marketSnapshot.status,
        weekEndingLabel,
        title: `Market Snapshot: Week Ending ${weekEndingLabel}`,
        items: marketSnapshot.items,
      },
      highestYieldingLowRoc,
      highestAdvertised,
      bestAfterTax,
      buyZone,
      bestWeeklyPayers,
      bestMonthlyPayers,
      weeklyMovers: {
        status: weeklyMovers.status,
        currentWeek: weeklyMovers.currentWeek,
        previousWeek: weeklyMovers.previousWeek,
        gainers: weeklyMovers.gainers,
        losers: weeklyMovers.losers,
      },
      largestHealthyAum,
      lowestExpenseHealthy,
      yieldTraps,
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
      { status: 500, headers: corsHeaders() },
    );
  }
});
