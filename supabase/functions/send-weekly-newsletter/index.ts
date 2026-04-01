import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types (match get-newsletter-insights response)
// ---------------------------------------------------------------------------

type InsightsPayload = {
  success: boolean;
  generatedAt?: string;
  taxRateDefault?: number;
  marketSnapshot: {
    status: string;
    weekEndingLabel: string;
    title: string;
    items: Array<{
      symbol: string;
      displayName: string;
      price: number | null;
      changesPercentage: number | null;
    }>;
  };
  highestYieldingLowRoc: Array<{
    ticker: string;
    name: string;
    canaryStatus: string;
    rocPercent: number | null;
    trueIncomeYield: number | null;
    totalReturn1YDisplay: string;
  }>;
  highestAdvertised: Array<{
    ticker: string;
    name: string;
    advertisedYield: number | null;
    trueIncomeYield: number | null;
  }>;
  bestAfterTax: Array<{
    ticker: string;
    name: string;
    canaryStatus: string;
    takeHomeCashReturnDisplay: string;
  }>;
  buyZone: Array<{
    ticker: string;
    name: string;
    trueIncomeYield: number | null;
    discountPct: number | null;
  }>;
  bestWeeklyPayers: Array<{
    ticker: string;
    name: string;
    trueIncomeYield: number | null;
    rocPercent: number | null;
    monthlySpendableCashYield: number | null;
  }>;
  bestMonthlyPayers: Array<{
    ticker: string;
    name: string;
    trueIncomeYield: number | null;
    rocPercent: number | null;
    monthlySpendableCashYield: number | null;
  }>;
  weeklyMovers: {
    status: string;
    currentWeek?: string;
    previousWeek?: string;
    gainers: Array<{
      ticker: string;
      rocChange: number;
      deathClockChange: number;
      trueIncomeChange: number;
      score: number;
      canaryHealth: string | null;
    }>;
    losers: Array<{
      ticker: string;
      rocChange: number;
      deathClockChange: number;
      trueIncomeChange: number;
      score: number;
      canaryHealth: string | null;
    }>;
  };
  largestHealthyAum: Array<{
    ticker: string;
    name: string;
    aumDisplay: string;
    trueIncomeYield: number | null;
    expenseRatio: number | null;
  }>;
  lowestExpenseHealthy: Array<{
    ticker: string;
    name: string;
    expenseRatio: number | null;
    trueIncomeYield: number | null;
    aumDisplay: string;
  }>;
  yieldTraps: Array<{
    ticker: string;
    name: string;
    canaryStatus: string;
    deathClock: string;
    trueIncomeYield: number | null;
  }>;
};

const SUPPORT_EMAIL = "support@yieldcanary.com";

/** Client Skool community — footer CTA (replaces “Explore Insights” in weekly email). */
const SKOOL_COMMUNITY_URL =
  "https://www.skool.com/swing-fit-wealth-9315/about";

/**
 * Set to "" for normal production sends to all recipients.
 * When non-empty: only that email receives the send if eligible.
 */
const TEMP_CRON_SEND_ONLY_EMAIL = "";

type NewsletterRecipient = {
  email: string;
  name: string | null;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function greetingTokenFromFullName(name: string | null | undefined): string {
  if (name == null || typeof name !== "string") return "there";
  const t = name.trim();
  if (!t) return "there";
  const first = t.split(/\s+/)[0];
  return first || "there";
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

/** Match Insights cards: DB may store yield as fraction or percent. */
function fmtPct(value: number | null | undefined): string {
  if (value == null) return "—";
  const v = value < 1 ? value * 100 : value;
  return `${v.toFixed(2)}%`;
}

function fmtDelta(value: number, suffix: string): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value).toFixed(2);
  return `${sign}${abs}${suffix}`;
}

function formatSnapPrice(price: number | null, symbol: string): string {
  if (price == null) return "—";
  if (symbol === "^VIX") return price.toFixed(2);
  if (price >= 1000) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (price >= 1) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return price.toFixed(4);
}

function formatSnapChange(pct: number | null): string {
  if (pct == null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function rowItem(ticker: string, value: string, sub?: string): string {
  const safeT = escapeHtml(ticker);
  const safeV = escapeHtml(value);
  const subHtml =
    sub != null ? `<span class="rs">${escapeHtml(sub)}</span> ` : "";
  return `<div class="r">${subHtml}<b class="rt">${safeT}</b> — <span class="rv">${safeV}</span></div>`;
}

function sectionBlock(
  title: string,
  subtitle: string | undefined,
  innerHtml: string,
  linkHref: string,
  linkLabel: string,
): string {
  const sub = subtitle
    ? `<p class="ss">${escapeHtml(subtitle)}</p>`
    : "";
  return `<div class="s"><h3>${escapeHtml(title)}</h3>${sub}<div>${innerHtml}</div><a href="${linkHref}" class="a">${escapeHtml(linkLabel)}</a></div>`;
}

function buildNewsletterHtml(
  data: InsightsPayload,
  appUrl: string,
  recipientNameFromDb: string | null,
): string {
  const safeGreeting = escapeHtml(
    greetingTokenFromFullName(recipientNameFromDb),
  );
  const dateStr = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  const taxNote =
    data.taxRateDefault != null
      ? `${data.taxRateDefault}% tax rate applied for spendable-yield and after-tax lists (newsletter default).`
      : "";

  const marketTitle =
    data.marketSnapshot?.title ??
    `Market Snapshot: Week Ending ${data.marketSnapshot?.weekEndingLabel ?? ""}`;

  let marketBody: string;
  if (
    data.marketSnapshot?.status === "ok" &&
    (data.marketSnapshot.items?.length ?? 0) > 0
  ) {
    marketBody = data.marketSnapshot.items
      .map((item) => {
        const label = `${item.displayName}:`;
        const value = `${formatSnapPrice(item.price, item.symbol)} (${formatSnapChange(item.changesPercentage)})`;
        return `<div class="sn"><b class="sn-label">${escapeHtml(label)}</b> <span class="sn-value">${escapeHtml(value)}</span></div>`;
      })
      .join("");
  } else {
    marketBody = `<div class="e">Market data temporarily unavailable.</div>`;
  }

  const moversOk = data.weeklyMovers?.status === "ok";
  const moversWeek = data.weeklyMovers?.currentWeek ?? "";
  const moversPrevWeek = data.weeklyMovers?.previousWeek ?? "";
  const moversHeader =
    moversOk && (moversWeek || moversPrevWeek)
      ? `Biggest movers (${moversWeek} vs ${moversPrevWeek})`
      : "Biggest movers";

  const empty = `<div class="e">No data this week.</div>`;

  const hiYieldRows =
    (data.highestYieldingLowRoc?.length ?? 0) > 0
      ? data.highestYieldingLowRoc
          .map((e) =>
            rowItem(
              e.ticker,
              `${fmtPct(e.trueIncomeYield)} True Yield, ${fmtPct(e.rocPercent)} ROC, ${e.totalReturn1YDisplay} 1Y`,
            ),
          )
          .join("")
      : empty;

  const afterTaxRows =
    (data.bestAfterTax?.length ?? 0) > 0
      ? data.bestAfterTax
          .map((e) => rowItem(e.ticker, `${e.takeHomeCashReturnDisplay} take-home cash`))
          .join("")
      : empty;

  const buyZoneRows =
    (data.buyZone?.length ?? 0) > 0
      ? data.buyZone
          .map((e) =>
            rowItem(
              e.ticker,
              `${fmtPct(e.trueIncomeYield)} True Yield${
                e.discountPct != null
                  ? ` (${e.discountPct.toFixed(1)}% below 90d avg)`
                  : ""
              }`,
            ),
          )
          .join("")
      : empty;

  const hiAdvRows =
    (data.highestAdvertised?.length ?? 0) > 0
      ? data.highestAdvertised
          .map((e) =>
            rowItem(
              e.ticker,
              `${fmtPct(e.advertisedYield)} advertised, ${fmtPct(e.trueIncomeYield)} true`,
            ),
          )
          .join("")
      : empty;

  const weeklyPayRows =
    (data.bestWeeklyPayers?.length ?? 0) > 0
      ? data.bestWeeklyPayers
          .map((e) =>
            rowItem(
              e.ticker,
              `${fmtPct(e.monthlySpendableCashYield)} monthly spendable cash yield, ${fmtPct(e.trueIncomeYield)} true, ${fmtPct(e.rocPercent)} ROC`,
            ),
          )
          .join("")
      : empty;

  const monthlyPayRows =
    (data.bestMonthlyPayers?.length ?? 0) > 0
      ? data.bestMonthlyPayers
          .map((e) =>
            rowItem(
              e.ticker,
              `${fmtPct(e.monthlySpendableCashYield)} monthly spendable cash yield, ${fmtPct(e.trueIncomeYield)} true, ${fmtPct(e.rocPercent)} ROC`,
            ),
          )
          .join("")
      : empty;

  const gainers = data.weeklyMovers?.gainers ?? [];
  const losers = data.weeklyMovers?.losers ?? [];
  const gainersHtml =
    gainers.length && moversOk
      ? gainers
          .map((g) =>
            rowItem(
              g.ticker,
              `True Inc. ${fmtDelta(g.trueIncomeChange, "%")}, ROC ${fmtDelta(g.rocChange, "%")}, Death Clock ${fmtDelta(g.deathClockChange, " yrs")}`,
              "↑",
            ),
          )
          .join("")
      : `<div class="e">No improvements data this week.</div>`;
  const losersHtml =
    losers.length && moversOk
      ? losers
          .map((g) =>
            rowItem(
              g.ticker,
              `True Inc. ${fmtDelta(g.trueIncomeChange, "%")}, ROC ${fmtDelta(g.rocChange, "%")}, Death Clock ${fmtDelta(g.deathClockChange, " yrs")}`,
              "↓",
            ),
          )
          .join("")
      : `<div class="e">No deteriorations data this week.</div>`;

  const aumRows =
    (data.largestHealthyAum?.length ?? 0) > 0
      ? data.largestHealthyAum
          .map((e) =>
            rowItem(
              e.ticker,
              `${e.aumDisplay} AUM, ${fmtPct(e.trueIncomeYield)} true, ${e.expenseRatio != null ? `${e.expenseRatio.toFixed(2)}%` : "—"} expense`,
            ),
          )
          .join("")
      : empty;

  const expRows =
    (data.lowestExpenseHealthy?.length ?? 0) > 0
      ? data.lowestExpenseHealthy
          .map((e) =>
            rowItem(
              e.ticker,
              `${e.expenseRatio != null ? `${e.expenseRatio.toFixed(2)}%` : "—"} expense, ${fmtPct(e.trueIncomeYield)} true, ${e.aumDisplay} AUM`,
            ),
          )
          .join("")
      : empty;

  const trapRows =
    (data.yieldTraps?.length ?? 0) > 0
      ? data.yieldTraps
          .map((e) =>
            rowItem(
              e.ticker,
              `${e.canaryStatus}, ${e.deathClock}, ${fmtPct(e.trueIncomeYield)} true`,
            ),
          )
          .join("")
      : empty;

  const insightsUrl = `${appUrl}/insights`;
  const pricingUrl = `${appUrl}/#pricing`;

  const sectionsHtml = [
    sectionBlock(
      marketTitle,
      "Friday-closing style quotes",
      marketBody,
      insightsUrl,
      "Open Insights for full market view →",
    ),
    sectionBlock(
      "Highest Yielding ETFs with No/Low NAV Erosion",
      "Healthy, 0–5% ROC, positive 1Y return, by True Yield.",
      hiYieldRows,
      insightsUrl,
      "See this list in Insights →",
    ),
    sectionBlock(
      "Best After-Tax Cash Flow",
      taxNote,
      afterTaxRows,
      insightsUrl,
      "See this list in Insights →",
    ),
    sectionBlock(
      "Buy Zone Picks — Undervalued Healthy ETFs",
      "Healthy, True Yield >10%, price below 90-day average.",
      buyZoneRows,
      insightsUrl,
      "See Buy Zone in Insights →",
    ),
    sectionBlock(
      "Highest Advertised Yield Funds",
      "Compare advertised vs true yield.",
      hiAdvRows,
      insightsUrl,
      "See this list in Insights →",
    ),
    sectionBlock(
      "Best Weekly Payers",
      taxNote,
      weeklyPayRows,
      insightsUrl,
      "See weekly payers in Insights →",
    ),
    sectionBlock(
      "Best Monthly Payers",
      taxNote,
      monthlyPayRows,
      insightsUrl,
      "See monthly payers in Insights →",
    ),
    `<div class="s"><h3>${escapeHtml(moversHeader)}</h3><p class="ms">Biggest improvements</p><div>${gainersHtml}</div><p class="ms" style="margin-top:12px">Biggest deteriorations</p><div>${losersHtml}</div><a href="${insightsUrl}" class="a">See movers in Insights →</a></div>`,
    sectionBlock(
      "Largest Healthy Funds by AUM",
      undefined,
      aumRows,
      insightsUrl,
      "See this list in Insights →",
    ),
    sectionBlock(
      "Lowest Expense Ratio Funds (Healthy Only)",
      undefined,
      expRows,
      insightsUrl,
      "See this list in Insights →",
    ),
    sectionBlock(
      "Yield Traps to Avoid",
      "Dying / Dead funds, shortest death clock first.",
      trapRows,
      insightsUrl,
      "See yield traps in Insights →",
    ),
  ].join("");

  const joinCta = `<div class="cta-join"><p class="cta-p"><strong>Get the full YieldCanary experience</strong></p><p class="cta-sub">Newsletter-only subscriber? Unlock live dashboards, tax-aware tools, watchlists, and every Insights list inside the app.</p><a href="${pricingUrl}" class="a">View plans and join YieldCanary →</a></div>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YieldCanary Weekly</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#1a2938;background:#f1f5f9;padding:16px}
.c{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);border:1px solid #e2e8f0;overflow:hidden}
.h{background:#0da472;color:#fff;padding:32px 24px;text-align:center}
.h h1{font-size:24px;font-weight:700;margin-bottom:8px}
.h p{font-size:14px;opacity:.95}
.intro{padding:36px 24px 36px;background:#fff;border-bottom:1px solid #e2e8f0}
.intro-p{font-size:16px;color:#334155;line-height:1.55;margin:0}
.x{padding:24px;background:#fff}
.s{background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #0da472;padding:20px;margin:16px 0;border-radius:8px}
.s h3{color:#1a2938;font-size:16px;margin-bottom:12px;font-weight:600}
.ss{font-size:13px;color:#64748b;margin:-6px 0 12px;line-height:1.45}
.r{color:#334155;padding:6px 0;font-size:14px}
.rt{color:#0da472}
.rv{color:#1a2938;font-weight:500}
.rs{color:#64748b;font-size:12px;margin-right:4px}
.e{color:#64748b;font-size:13px;padding:6px 0}
.sn{font-size:14px;padding:8px 0;border-bottom:1px solid #e2e8f0}
.sn-label{color:#0da472}
.sn-value{color:#1a2938;font-weight:500}
.sn:last-child{border-bottom:none}
.a{display:inline-block;background:#0da472;color:#fff!important;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;margin-top:10px;text-transform:capitalize}
.a-outline{background:#fff!important;color:#0da472!important;border:2px solid #0da472}
.f-cta{text-align:center;margin-bottom:18px;font-size:0}
.f-btn{display:inline-block;margin:6px 10px;font-size:0}
.f-btn .a{display:inline-block;font-size:13px;margin:0}
.ms{font-size:12px;color:#64748b;font-weight:600;margin-bottom:6px}
.cta-join{background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #1a8cd8;padding:22px 20px;margin:8px 0 0;border-radius:8px;text-align:center}
.cta-p{font-size:17px;color:#1a2938;margin-bottom:8px}
.cta-sub{font-size:14px;color:#475569;margin-bottom:14px;line-height:1.5}
.f{background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0}
.ft{font-size:13px;color:#64748b;margin-bottom:8px}
.f a{color:#0da472;text-decoration:none;font-weight:500}
.fc{font-size:11px;color:#64748b;margin-top:16px}
@media(max-width:600px){body{padding:8px}.h,.x{padding:20px 16px}.h h1{font-size:20px}.intro{padding:32px 16px 32px}.intro-p{font-size:15px}.s{padding:16px;margin:12px 0}.r{font-size:13px}.a{padding:8px 16px;font-size:12px}.f{padding:20px 16px}.f-btn{display:block!important;width:100%!important;margin:0 0 12px 0!important;box-sizing:border-box!important}.f-btn:last-child{margin-bottom:0!important}.f-btn .a{display:block!important;width:100%!important;text-align:center!important;box-sizing:border-box!important}}
</style></head><body><div class="c"><div class="h"><h1>🐦 YieldCanary</h1><p>YieldCanary Weekly — ${escapeHtml(dateStr)}</p></div><div class="intro"><p class="intro-p"><strong>Hey ${safeGreeting}!</strong> Here's your YieldCanary Weekly — a market snapshot, the same curated top lists you see on Insights (top 5 each), and this week's biggest movers.</p></div><div class="x">${sectionsHtml}${joinCta}</div><div class="f"><div class="f-cta"><div class="f-btn"><a href="${appUrl}/dashboard" class="a">Open your dashboard →</a></div><div class="f-btn"><a href="${SKOOL_COMMUNITY_URL}" class="a a-outline" target="_blank" rel="noopener noreferrer">Join Our Free Skool Community →</a></div></div><p class="ft"><a href="${appUrl}/dashboard">Manage your account</a> · <a href="mailto:${SUPPORT_EMAIL}">Contact support</a></p><p class="ft">You're receiving this because you have an active YieldCanary plan or newsletter subscription.</p><p class="fc">© 2026 YieldCanary. All rights reserved.</p></div></div></body></html>`;
}

function isValidInsightsPayload(json: Record<string, unknown>): boolean {
  if (json.success !== true) return false;
  if (!Array.isArray(json.buyZone)) return false;
  if (!json.marketSnapshot || typeof json.marketSnapshot !== "object") {
    return false;
  }
  return true;
}

async function fetchInsights(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<InsightsPayload> {
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
  const json = (await res.json()) as Record<string, unknown>;
  if (!isValidInsightsPayload(json)) {
    throw new Error("Invalid response from get-newsletter-insights");
  }
  return json as unknown as InsightsPayload;
}

function mergeDisplayName(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  const pick = (n: string | null | undefined) => {
    if (n == null || typeof n !== "string") return null;
    const t = n.trim();
    return t.length > 0 ? t : null;
  };
  return pick(existing) ?? pick(incoming) ?? null;
}

async function getNewsletterRecipients(
  supabase: ReturnType<typeof createClient>,
): Promise<NewsletterRecipient[]> {
  const [appResult, nlResult] = await Promise.all([
    supabase
      .from("users")
      .select("email, name")
      .in("subscription_tier", ["basic", "advanced"])
      .in("subscription_status", ["active", "trialing"]),
    supabase
      .from("users")
      .select("email, name")
      .in("newsletter_tier", ["monthly", "yearly"]),
  ]);

  if (appResult.error) {
    throw new Error(
      `Failed to fetch app subscribers: ${appResult.error.message}`,
    );
  }
  if (nlResult.error) {
    throw new Error(
      `Failed to fetch newsletter subscribers: ${nlResult.error.message}`,
    );
  }

  const byEmail = new Map<string, string | null>();
  for (const r of [...(appResult.data ?? []), ...(nlResult.data ?? [])]) {
    if (typeof r.email !== "string" || r.email.length === 0) continue;
    const prev = byEmail.get(r.email);
    const merged = mergeDisplayName(prev, r.name ?? null);
    byEmail.set(r.email, merged);
  }

  return [...byEmail.entries()].map(([email, name]) => ({ email, name }));
}

async function lookupUserNameByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("name")
    .ilike("email", email.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data.name ?? null;
}

async function getTempCronRecipientIfEligible(
  supabase: ReturnType<typeof createClient>,
  rawEmail: string,
): Promise<NewsletterRecipient[]> {
  const trimmed = rawEmail.trim();
  if (!trimmed) return [];

  const [appResult, nlResult] = await Promise.all([
    supabase
      .from("users")
      .select("email, name")
      .ilike("email", trimmed)
      .in("subscription_tier", ["basic", "advanced"])
      .in("subscription_status", ["active", "trialing"])
      .maybeSingle(),
    supabase
      .from("users")
      .select("email, name")
      .ilike("email", trimmed)
      .in("newsletter_tier", ["monthly", "yearly"])
      .maybeSingle(),
  ]);

  if (appResult.error) {
    throw new Error(`Temp recipient app lookup failed: ${appResult.error.message}`);
  }
  if (nlResult.error) {
    throw new Error(
      `Temp recipient newsletter lookup failed: ${nlResult.error.message}`,
    );
  }

  const email = (appResult.data?.email ?? nlResult.data?.email) as
    | string
    | undefined;
  if (!email) {
    console.warn(
      "[send-weekly-newsletter] TEMP_CRON_SEND_ONLY_EMAIL not eligible (need basic/advanced active/trialing OR newsletter monthly/yearly):",
      trimmed,
    );
    return [];
  }
  const name = mergeDisplayName(appResult.data?.name, nlResult.data?.name);
  return [{ email, name }];
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  resendApiKey: string,
  resendFromEmail: string,
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
      { status: 405, headers: corsHeaders() },
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
        { status: 500, headers: corsHeaders() },
      );
    }

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

    const subjectDate = data.generatedAt
      ? new Date(data.generatedAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
    const subject = preview
      ? `[Preview] YieldCanary Weekly — ${subjectDate}`
      : `YieldCanary Weekly — ${subjectDate}`;

    let recipients: NewsletterRecipient[];
    if (preview) {
      const previewName = await lookupUserNameByEmail(supabase, SUPPORT_EMAIL);
      recipients = [{ email: SUPPORT_EMAIL, name: previewName }];
      console.log(
        "[send-weekly-newsletter] Preview mode: sending only to",
        SUPPORT_EMAIL,
      );
    } else {
      const tempOnly = TEMP_CRON_SEND_ONLY_EMAIL.trim();
      if (tempOnly) {
        recipients = await getTempCronRecipientIfEligible(supabase, tempOnly);
        console.log(
          "[send-weekly-newsletter] TEMP_CRON_SEND_ONLY_EMAIL mode: eligible recipients =",
          recipients.length,
          recipients.length ? recipients[0].email : "(none)",
        );
      } else {
        recipients = await getNewsletterRecipients(supabase);
        console.log(
          "[send-weekly-newsletter] Sending to",
          recipients.length,
          "subscribers",
        );
      }
    }

    let sent = 0;
    for (const rec of recipients) {
      const html = buildNewsletterHtml(data, appUrl, rec.name);
      const ok = await sendViaResend(
        rec.email,
        subject,
        html,
        resendApiKey,
        resendFromEmail,
      );
      if (ok) sent++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        total: recipients.length,
        preview,
        temp_send_only:
          !preview && TEMP_CRON_SEND_ONLY_EMAIL.trim().length > 0,
      }),
      { status: 200, headers: corsHeaders() },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-weekly-newsletter]", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: corsHeaders() },
    );
  }
});
