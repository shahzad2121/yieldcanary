import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  buildNewsletterHtml,
  type InsightsPayload,
  isValidInsightsPayload,
  sendWeeklyNewsletterEmail,
  SUPPORT_EMAIL,
} from "../_shared/weeklyNewsletterHtml.ts";

/**
 * When not "false", bulk sends only enqueue DB rows; process-newsletter-jobs sends via Resend.
 * Preview, temp single-recipient, and explicit sync=true always send immediately.
 */
function useNewsletterQueue(): boolean {
  return Deno.env.get("NEWSLETTER_USE_QUEUE") !== "false";
}

/**
 * Set to "" for normal production sends to all recipients.
 * When non-empty: only that email receives the send if eligible.
 */
const TEMP_CRON_SEND_ONLY_EMAIL = "";

type NewsletterRecipient = {
  email: string;
  name: string | null;
};

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

const INSERT_CHUNK = 300;

async function enqueueNewsletterJobs(
  supabase: ReturnType<typeof createClient>,
  data: InsightsPayload,
  subject: string,
  appUrl: string,
  recipients: NewsletterRecipient[],
): Promise<string> {
  const { data: runRow, error: runErr } = await supabase
    .from("newsletter_runs")
    .insert({
      subject,
      app_url: appUrl,
      payload: data as unknown as Record<string, unknown>,
      status: "enqueued",
    })
    .select("id")
    .single();

  if (runErr) {
    throw new Error(`Failed to create newsletter run: ${runErr.message}`);
  }

  const runId = runRow.id as string;
  const rows = recipients.map((r) => ({
    run_id: runId,
    email: r.email,
    recipient_name: r.name,
    status: "pending",
  }));

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const slice = rows.slice(i, i + INSERT_CHUNK);
    const { error: jobErr } = await supabase.from("email_jobs").insert(slice);
    if (jobErr) {
      throw new Error(
        `Failed to insert email_jobs: ${jobErr.message}`,
      );
    }
  }

  return runId;
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
    let forceSync = false;
    try {
      const url = new URL(req.url);
      preview = url.searchParams.get("preview") === "true";
      forceSync = url.searchParams.get("sync") === "true";
    } catch {
      // ignore
    }
    if (!preview && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        preview = body.preview === true;
        forceSync = forceSync || body.sync === true;
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
          "[send-weekly-newsletter] Recipients:",
          recipients.length,
        );
      }
    }

    const queueOk = useNewsletterQueue() && !preview && !forceSync &&
      TEMP_CRON_SEND_ONLY_EMAIL.trim().length === 0;

    if (queueOk && recipients.length > 0) {
      const runId = await enqueueNewsletterJobs(
        supabase,
        data,
        subject,
        appUrl,
        recipients,
      );
      console.log(
        "[send-weekly-newsletter] Enqueued run",
        runId,
        "jobs:",
        recipients.length,
      );
      return new Response(
        JSON.stringify({
          success: true,
          mode: "queued",
          run_id: runId,
          enqueued: recipients.length,
          preview: false,
          temp_send_only: false,
          message:
            "Jobs enqueued. Ensure cron calls process-newsletter-jobs until the queue is empty.",
        }),
        { status: 200, headers: corsHeaders() },
      );
    }

    let sent = 0;
    for (const rec of recipients) {
      const html = buildNewsletterHtml(data, appUrl, rec.name);
      const result = await sendWeeklyNewsletterEmail(
        rec.email,
        subject,
        html,
        resendApiKey,
        resendFromEmail,
      );
      if (result.ok) sent++;
      else {
        console.error(
          `[send-weekly-newsletter] Resend ${rec.email}:`,
          result.status,
          result.body,
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: "sync",
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
