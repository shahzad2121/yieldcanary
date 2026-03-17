import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types (match get-newsletter-insights response)
// ---------------------------------------------------------------------------

type InsightsPayload = {
  success: boolean;
  generatedAt?: string;
  buyZone: Array<{
    ticker: string;
    name: string;
    trueIncomeYield: number | null;
    discountPct: number | null;
  }>;
  topMonthlyPayers: Array<{
    ticker: string;
    name: string;
    trueIncomeYield: number | null;
    monthlySpendableCashYield: number | null;
  }>;
  topWeeklyPayers: Array<{
    ticker: string;
    name: string;
    trueIncomeYield: number | null;
    monthlySpendableCashYield: number | null;
  }>;
  weeklyMovers: {
    status: string;
    currentWeek?: string;
    previousWeek?: string;
    gainers: Array<{
      ticker: string;
      rocChange: number;
      trueIncomeChange: number;
      score: number;
      canaryHealth: string | null;
    }>;
    losers: Array<{
      ticker: string;
      rocChange: number;
      trueIncomeChange: number;
      score: number;
      canaryHealth: string | null;
    }>;
  };
};

const MAX_ITEMS_PER_SECTION = 5;
const SUPPORT_EMAIL = "support@yieldcanary.com";

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

function fmtPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

/** Build newsletter HTML matching transactional templates: same header, footer, colors, responsive. */
function buildNewsletterHtml(data: InsightsPayload, appUrl: string): string {
  const dateStr = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  const buyZoneRows = (data.buyZone ?? []).slice(0, MAX_ITEMS_PER_SECTION);
  const monthlyRows = (data.topMonthlyPayers ?? []).slice(0, MAX_ITEMS_PER_SECTION);
  const weeklyRows = (data.topWeeklyPayers ?? []).slice(0, MAX_ITEMS_PER_SECTION);
  const gainers = (data.weeklyMovers?.gainers ?? []).slice(0, MAX_ITEMS_PER_SECTION);
  const losers = (data.weeklyMovers?.losers ?? []).slice(0, MAX_ITEMS_PER_SECTION);
  const moversWeek = data.weeklyMovers?.currentWeek ?? "";
  const moversPrevWeek = data.weeklyMovers?.previousWeek ?? "";
  const moversHeader =
    data.weeklyMovers?.status === "ok" && (moversWeek || moversPrevWeek)
      ? `Week of ${moversWeek} vs ${moversPrevWeek}`
      : "Weekly movers";

  const rowItem = (ticker: string, value: string, sub?: string) =>
    `<div class="r">${sub != null ? `<span class="rs">${sub}</span> ` : ""}<b class="rt">${ticker}</b> — <span class="rv">${value}</span></div>`;

  const buyZoneRowsHtml = buyZoneRows.length
    ? buyZoneRows
        .map((e) =>
          rowItem(
            e.ticker,
            `${fmtPct(e.trueIncomeYield)} True Yield${e.discountPct != null ? ` (${e.discountPct.toFixed(1)}% below 90d avg)` : ""}`,
            undefined
          )
        )
        .join("")
    : "<div class=\"e\">No picks this week.</div>";

  const monthlyRowsHtml = monthlyRows.length
    ? monthlyRows
        .map((e) => rowItem(e.ticker, `${fmtPct(e.monthlySpendableCashYield)} monthly yield`))
        .join("")
    : "<div class=\"e\">No monthly payers this week.</div>";

  const weeklyRowsHtml = weeklyRows.length
    ? weeklyRows
        .map((e) => rowItem(e.ticker, `${fmtPct(e.monthlySpendableCashYield)} monthly yield`))
        .join("")
    : "<div class=\"e\">No weekly payers this week.</div>";

  const gainersHtml =
    gainers.length && data.weeklyMovers?.status === "ok"
      ? gainers
          .map((g) =>
            rowItem(
              g.ticker,
              `True Yield ${g.trueIncomeChange >= 0 ? "+" : ""}${g.trueIncomeChange.toFixed(2)}%`,
              "↑"
            )
          )
          .join("")
      : "<div class=\"e\">No data this week.</div>";

  const losersHtml =
    losers.length && data.weeklyMovers?.status === "ok"
      ? losers
          .map((g) =>
            rowItem(
              g.ticker,
              `True Yield ${g.trueIncomeChange >= 0 ? "+" : ""}${g.trueIncomeChange.toFixed(2)}%`,
              "↓"
            )
          )
          .join("")
      : "<div class=\"e\">No data this week.</div>";

  // Minimal HTML to stay under Gmail ~102KB clip limit. Short class names, no external font, solid colors.
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YieldCanary Weekly</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#1a2938;background:#f1f5f9;padding:16px}
.c{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);border:1px solid #e2e8f0;overflow:hidden}
.h{background:#0da472;color:#fff;padding:32px 24px;text-align:center}
.h h1{font-size:24px;font-weight:700;margin-bottom:8px}
.h p{font-size:14px;opacity:.95}
.x{padding:24px;background:#fff}
.s{background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #0da472;padding:20px;margin:16px 0;border-radius:8px}
.s h3{color:#1a2938;font-size:16px;margin-bottom:12px;font-weight:600}
.r{color:#334155;padding:6px 0;font-size:14px}
.rt{color:#0da472}
.rv{color:#1a2938;font-weight:500}
.rs{color:#64748b;font-size:12px;margin-right:4px}
.e{color:#64748b;font-size:13px;padding:6px 0}
.a{display:inline-block;background:#0da472;color:#fff!important;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;margin-top:10px}
.ms{font-size:12px;color:#64748b;font-weight:600;margin-bottom:6px}
.f{background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0}
.ft{font-size:13px;color:#64748b;margin-bottom:8px}
.f a{color:#0da472;text-decoration:none;font-weight:500}
.fc{font-size:11px;color:#64748b;margin-top:16px}
@media(max-width:600px){body{padding:8px}.h,.x{padding:20px 16px}.h h1{font-size:20px}.s{padding:16px;margin:12px 0}.r{font-size:13px}.a{padding:8px 16px;font-size:12px}.f{padding:20px 16px}}
</style></head><body><div class="c"><div class="h"><h1>🐦 YieldCanary</h1><p>YieldCanary Weekly — ${dateStr}</p></div><div class="x"><div class="s"><h3>📊 Buy Zone Picks</h3><div>${buyZoneRowsHtml}</div><a href="${appUrl}/insights" class="a">See all Buy Zone picks →</a></div><div class="s"><h3>📅 Top Monthly Payers</h3><div>${monthlyRowsHtml}</div><a href="${appUrl}/insights" class="a">See all monthly payers →</a></div><div class="s"><h3>📅 Top Weekly Payers</h3><div>${weeklyRowsHtml}</div><a href="${appUrl}/insights" class="a">See all weekly payers →</a></div><div class="s"><h3>📈 ${moversHeader}</h3><p class="ms">Biggest improvements</p><div>${gainersHtml}</div><p class="ms" style="margin-top:12px">Biggest deteriorations</p><div>${losersHtml}</div><a href="${appUrl}/insights" class="a">See movers in Insights →</a></div></div><div class="f"><p class="ft">You're receiving this because you subscribed to the YieldCanary Weekly Newsletter.</p><p class="ft"><a href="${appUrl}">Open YieldCanary</a> · Manage subscription in your account.</p><p class="fc">© 2026 YieldCanary. All rights reserved.</p></div></div></body></html>`;
}

async function fetchInsights(supabaseUrl: string, serviceRoleKey: string): Promise<InsightsPayload> {
  const res = await fetch(`${supabaseUrl}/functions/v1/get-newsletter-insights`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`get-newsletter-insights failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  if (!json.success || !json.buyZone) {
    throw new Error("Invalid response from get-newsletter-insights");
  }
  return json as InsightsPayload;
}

async function getSubscriberEmails(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await supabase
    .from("users")
    .select("email")
    .in("newsletter_tier", ["monthly", "yearly"]);
  if (error) {
    throw new Error(`Failed to fetch subscribers: ${error.message}`);
  }
  const rows = (data ?? []) as { email?: string }[];
  const emails = rows
    .map((r) => r.email)
    .filter((e): e is string => typeof e === "string" && e.length > 0);
  return [...new Set(emails)];
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  resendApiKey: string,
  resendFromEmail: string
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[send-weekly-newsletter] Resend error for ${to}:`, text);
    return false;
  }
  return true;
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey =
      Deno.env.get("SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const resendFromEmail =
      Deno.env.get("RESEND_FROM_EMAIL") ?? "YieldCanary <support@yieldcanary.com>";
    const appUrl = Deno.env.get("NEWSLETTER_APP_URL") ?? "https://yieldcanary.com";

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not set" }),
        { status: 500, headers: corsHeaders() }
      );
    }

    // Preview mode: ?preview=true or body { preview: true } → send only to support@
    let preview = false;
    try {
      const url = new URL(req.url);
      preview = url.searchParams.get("preview") === "true";
    } catch {
      // ignore
    }
    if (!preview && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        preview = body.preview === true;
      } catch {
        // ignore
      }
    }

    const supabase = getSupabaseClient();
    const data = await fetchInsights(supabaseUrl, serviceRoleKey);
    const html = buildNewsletterHtml(data, appUrl);

    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const subject = preview
      ? `[Preview] YieldCanary Weekly — ${dateStr}`
      : `YieldCanary Weekly — ${dateStr}`;

    let recipients: string[];
    if (preview) {
      recipients = [SUPPORT_EMAIL];
      console.log("[send-weekly-newsletter] Preview mode: sending only to", SUPPORT_EMAIL);
    } else {
      recipients = await getSubscriberEmails(supabase);
      console.log("[send-weekly-newsletter] Sending to", recipients.length, "subscribers");
    }

    let sent = 0;
    for (const email of recipients) {
      const ok = await sendViaResend(
        email,
        subject,
        html,
        resendApiKey,
        resendFromEmail
      );
      if (ok) sent++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        total: recipients.length,
        preview,
      }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-weekly-newsletter]", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: corsHeaders() }
    );
  }
});
