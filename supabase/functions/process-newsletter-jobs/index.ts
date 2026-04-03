import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  buildNewsletterHtml,
  type InsightsPayload,
  sendWeeklyNewsletterEmail,
} from "../_shared/weeklyNewsletterHtml.ts";

type EmailJobRow = {
  id: string;
  run_id: string;
  email: string;
  recipient_name: string | null;
  status: string;
  attempts: number;
};

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-cron-secret",
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const MAX_ATTEMPTS_BEFORE_FAIL = 12;

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

  const cronSecret = Deno.env.get("NEWSLETTER_CRON_SECRET") ?? "";
  if (cronSecret) {
    const hdr =
      req.headers.get("x-cron-secret") ??
      (req.headers.get("Authorization")?.startsWith("Bearer ")
        ? req.headers.get("Authorization")!.slice(7)
        : null);
    if (hdr !== cronSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() },
      );
    }
  }

  try {
    const supabase = getSupabaseClient();
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const resendFromEmail =
      Deno.env.get("RESEND_FROM_EMAIL") ?? "YieldCanary <support@yieldcanary.com>";

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not set" }),
        { status: 500, headers: corsHeaders() },
      );
    }

    const batchSize = Math.min(
      50,
      Math.max(1, parseInt(Deno.env.get("NEWSLETTER_JOB_BATCH") ?? "12", 10)),
    );
    const sleepMs = Math.max(
      0,
      parseInt(Deno.env.get("NEWSLETTER_JOB_SLEEP_MS") ?? "350", 10),
    );
    const sleep429Ms = Math.max(
      500,
      parseInt(Deno.env.get("NEWSLETTER_JOB_429_SLEEP_MS") ?? "2500", 10),
    );

    await supabase.rpc("reset_stale_newsletter_jobs", {
      stale_after: "45 minutes",
    });

    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_newsletter_jobs",
      { p_limit: batchSize },
    );

    if (claimError) {
      console.error("[process-newsletter-jobs] claim error:", claimError.message);
      return new Response(
        JSON.stringify({ success: false, error: claimError.message }),
        { status: 500, headers: corsHeaders() },
      );
    }

    const jobs = (claimed ?? []) as EmailJobRow[];
    /** When set, only this address is sent via Resend; other jobs are marked sent without emailing (queue + batching still run). Unset in production. */
    const sendOnlyToRaw = Deno.env.get("NEWSLETTER_SEND_ONLY_TO_EMAIL")?.trim();
    const sendOnlyTo =
      sendOnlyToRaw && sendOnlyToRaw.length > 0
        ? sendOnlyToRaw.toLowerCase()
        : null;

    let sent = 0;
    let failed = 0;
    let skippedSendFilter = 0;
    const errors: string[] = [];

    for (const job of jobs) {
      const { data: run, error: runError } = await supabase
        .from("newsletter_runs")
        .select("subject,app_url,payload")
        .eq("id", job.run_id)
        .maybeSingle();

      if (runError || !run) {
        await supabase
          .from("email_jobs")
          .update({
            status: "failed",
            last_error: runError?.message ?? "run not found",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        failed++;
        continue;
      }

      const payload = run.payload as unknown as InsightsPayload;
      const html = buildNewsletterHtml(
        payload,
        run.app_url as string,
        job.recipient_name,
      );

      const nowIso = new Date().toISOString();

      if (
        sendOnlyTo != null &&
        job.email.trim().toLowerCase() !== sendOnlyTo
      ) {
        await supabase
          .from("email_jobs")
          .update({
            status: "sent",
            last_error: "skipped: NEWSLETTER_SEND_ONLY_TO_EMAIL (no Resend)",
            updated_at: nowIso,
          })
          .eq("id", job.id);
        skippedSendFilter++;
        if (sleepMs > 0) await sleep(sleepMs);
        continue;
      }

      const result = await sendWeeklyNewsletterEmail(
        job.email,
        run.subject as string,
        html,
        resendApiKey,
        resendFromEmail,
      );

      const nextAttempts = (job.attempts ?? 0) + 1;

      if (result.ok) {
        await supabase
          .from("email_jobs")
          .update({
            status: "sent",
            last_error: null,
            updated_at: nowIso,
          })
          .eq("id", job.id);
        sent++;
      } else if (result.status === 429) {
        const backToPending = nextAttempts < MAX_ATTEMPTS_BEFORE_FAIL;
        await supabase
          .from("email_jobs")
          .update({
            status: backToPending ? "pending" : "failed",
            attempts: nextAttempts,
            last_error: `429 ${result.body.slice(0, 500)}`,
            updated_at: nowIso,
          })
          .eq("id", job.id);
        if (!backToPending) failed++;
        await sleep(sleep429Ms);
      } else {
        const backToPending = nextAttempts < MAX_ATTEMPTS_BEFORE_FAIL;
        await supabase
          .from("email_jobs")
          .update({
            status: backToPending ? "pending" : "failed",
            attempts: nextAttempts,
            last_error: `${result.status} ${result.body.slice(0, 500)}`,
            updated_at: nowIso,
          })
          .eq("id", job.id);
        if (!backToPending) failed++;
        errors.push(`${job.email}: ${result.status}`);
      }

      if (sleepMs > 0) await sleep(sleepMs);
    }

    const { data: finalized } = await supabase.rpc(
      "finalize_completed_newsletter_runs",
    );

    return new Response(
      JSON.stringify({
        success: true,
        claimed: jobs.length,
        sent,
        failed,
        skipped_send_filter: skippedSendFilter,
        send_only_to_active: sendOnlyTo != null,
        runs_finalized: finalized ?? 0,
        errors: errors.slice(0, 10),
      }),
      { status: 200, headers: corsHeaders() },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[process-newsletter-jobs]", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: corsHeaders() },
    );
  }
});
