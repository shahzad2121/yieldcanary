import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getSupabaseConfig,
  getSupabaseHeaders,
  sendTransactionalEmail,
  type User,
} from "./stripe-webhook-helpers.ts";

/**
 * send-trial-ending-reminders
 *
 * Run via Supabase Cron (UTC).
 * Sends `trial_ending_reminder` to users whose trial ends within the next 24 hours.
 *
 * Target conditions:
 * - users.subscription_status = 'trialing'
 * - users.trial_ends_at in [now, now + 24h)
 */

function formatDateUTC(iso: string): string {
  const d = new Date(iso);
  // YYYY-MM-DD in UTC (stable across locales)
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

Deno.serve(async (req) => {
  // Allow manual triggering (POST) and cron triggers.
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const nowIso = now.toISOString();
  const in24hIso = in24h.toISOString();

  console.log(`[Reminder] Running trial-ending reminders (UTC). Window: ${nowIso} → ${in24hIso}`);

  // Query trialing users whose trial ends in next 24h (UTC)
  const select = "id,email,name,username,trial_ends_at";
  const usersRes = await fetch(
    `${supabaseUrl}/rest/v1/users?select=${select}` +
      `&subscription_status=eq.trialing` +
      `&trial_ends_at=gte.${nowIso}` +
      `&trial_ends_at=lt.${in24hIso}`,
    { headers: getSupabaseHeaders(serviceRoleKey) }
  );

  if (!usersRes.ok) {
    const errText = await usersRes.text();
    console.error(`[Reminder] Failed to query users: ${usersRes.status} ${errText}`);
    return new Response(JSON.stringify({ ok: false, error: "Failed to query users" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const users = (await usersRes.json()) as User[];
  console.log(`[Reminder] Found ${users.length} trialing users ending within 24h`);

  let attempted = 0;
  let sent = 0;
  let skipped = 0;

  for (const u of users) {
    if (!u?.id || !u?.email || !u?.trial_ends_at) continue;

    attempted++;
    const firstName = u.name || u.username || u.email.split("@")[0];
    const trialEndDate = formatDateUTC(u.trial_ends_at);

    const didSend = await sendTransactionalEmail(
      supabaseUrl,
      serviceRoleKey,
      u.id,
      u.email,
      "trial_ending_reminder",
      "trial_ending_reminder",
      {
        first_name: firstName,
        trial_end_date: trialEndDate,
      }
    );

    if (didSend) sent++;
    else skipped++;
  }

  console.log(`[Reminder] Done. attempted=${attempted} sent=${sent} skipped=${skipped}`);

  return new Response(JSON.stringify({ ok: true, attempted, sent, skipped }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

