import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

type WeeklyMover = {
  ticker: string;
  rocChange: number;
  deathClockChange: number;
  trueIncomeChange: number;
  score: number;
  canaryHealth: string | null;
};

type WeeklyMoversResponse =
  | {
      success: true;
      status: "ok";
      currentWeek: string;
      previousWeek: string;
      gainers: WeeklyMover[];
      losers: WeeklyMover[];
    }
  | {
      success: true;
      status: "insufficient_history";
      message: string;
    }
  | {
      success: false;
      error: string;
    };

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}

function createSupabaseClient() {
  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in Edge Function environment"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

async function getLatestTwoWeeks(
  supabase: ReturnType<typeof createSupabaseClient>
): Promise<string[]> {
  // Fetch week_start_date values (most recent first), then dedupe in memory.
  const { data, error } = await supabase
    .from("etf_weekly_snapshots")
    .select("week_start_date")
    .order("week_start_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load weeks: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const uniqueWeeks: string[] = [];
  for (const row of data as { week_start_date: string }[]) {
    if (!seen.has(row.week_start_date)) {
      seen.add(row.week_start_date);
      uniqueWeeks.push(row.week_start_date);
    }
    if (uniqueWeeks.length >= 2) break;
  }

  return uniqueWeeks;
}

async function computeWeeklyMovers(
  supabase: ReturnType<typeof createSupabaseClient>
): Promise<WeeklyMoversResponse> {
  const weeks = await getLatestTwoWeeks(supabase);

  if (weeks.length < 2) {
    return {
      success: true,
      status: "insufficient_history",
      message:
        "Not enough weekly snapshots yet. At least two weeks of history are required.",
    };
  }

  const [currentWeek, previousWeek] = weeks;

  type SnapshotRow = {
    ticker_id: string;
    week_start_date: string;
    roc_percent: number | null;
    death_clock_years: number | null;
    true_income_yield: number | null;
    canary_health: string | null;
    etfs: {
      ticker: string | null;
    } | null;
  };

  const { data, error } = await supabase
    .from("etf_weekly_snapshots")
    .select(
      "ticker_id, week_start_date, roc_percent, death_clock_years, true_income_yield, canary_health, etfs(ticker)"
    )
    .in("week_start_date", [currentWeek, previousWeek]);

  if (error) {
    throw new Error(`Failed to load snapshots: ${error.message}`);
  }

  const rows = (data ?? []) as SnapshotRow[];

  const currentByTicker = new Map<string, SnapshotRow>();
  const previousByTicker = new Map<string, SnapshotRow>();

  for (const row of rows) {
    if (row.week_start_date === currentWeek) {
      currentByTicker.set(row.ticker_id, row);
    } else if (row.week_start_date === previousWeek) {
      previousByTicker.set(row.ticker_id, row);
    }
  }

  const movers: WeeklyMover[] = [];

  for (const [tickerId, curr] of currentByTicker.entries()) {
    const prev = previousByTicker.get(tickerId);
    if (!prev) continue;

    const ticker = curr.etfs?.ticker ?? "UNKNOWN";

    const currRoc = curr.roc_percent;
    const prevRoc = prev.roc_percent;
    const currDeath = curr.death_clock_years;
    const prevDeath = prev.death_clock_years;
    const currTrue = curr.true_income_yield;
    const prevTrue = prev.true_income_yield;

    // Require complete data both weeks
    if (
      currRoc == null ||
      prevRoc == null ||
      currDeath == null ||
      prevDeath == null ||
      currTrue == null ||
      prevTrue == null
    ) {
      continue;
    }

    const rocChange = currRoc - prevRoc; // negative = improvement
    const deathClockChange = currDeath - prevDeath; // positive = improvement
    const trueIncomeChange = currTrue - prevTrue; // positive = improvement

    const score = -rocChange + deathClockChange + trueIncomeChange;

    movers.push({
      ticker,
      rocChange,
      deathClockChange,
      trueIncomeChange,
      score,
      canaryHealth: curr.canary_health,
    });
  }

  // Sort for gainers (biggest improvement first) - only include actual improvements (score > 0)
  const gainers = [...movers]
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Sort for losers (biggest deterioration first) - only include actual deteriorations (score < 0)
  const losers = [...movers]
    .filter((m) => m.score < 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  return {
    success: true,
    status: "ok",
    currentWeek,
    previousWeek,
    gainers,
    losers,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    const body: WeeklyMoversResponse = {
      success: false,
      error: "Method not allowed",
    };
    return new Response(JSON.stringify(body), {
      status: 405,
      headers: corsHeaders(),
    });
  }

  let supabase;
  try {
    supabase = createSupabaseClient();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to initialize Supabase client";
    const body: WeeklyMoversResponse = {
      success: false,
      error: message,
    };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: corsHeaders(),
    });
  }

  try {
    const result = await computeWeeklyMovers(supabase);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to compute weekly movers";
    const body: WeeklyMoversResponse = {
      success: false,
      error: message,
    };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});

