/**
 * Local copy of Stripe webhook helpers for this function.
 *
 * NOTE: Supabase dashboard deployments bundle each function folder separately.
 * Keeping a local helper file avoids "Module not found" issues from ../ imports.
 */

export type EmailType =
  | 'trial_started'
  | 'trial_ending_reminder'
  | 'trial_converted_to_paid'
  | 'payment_failed'
  | 'subscription_cancelled';

export type EmailStatus = 'sent' | 'failed' | 'bounced' | 'delivered';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
  trial_ends_at?: string | null;
}

export function getSupabaseConfig() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SERVICE_ROLE_KEY must be set");
  }
  return { supabaseUrl, serviceRoleKey };
}

export function getSupabaseHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Check if a successful email (sent/delivered) was sent today.
 * Failed sends do NOT block retries.
 */
export async function wasEmailSentToday(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  emailType: EmailType
): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(
    `${supabaseUrl}/rest/v1/email_logs?user_id=eq.${userId}&email_type=eq.${emailType}&status=in.(sent,delivered)&sent_at=gte.${today}`,
    { headers: getSupabaseHeaders(serviceRoleKey) }
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

export async function logEmailSent(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  emailType: EmailType,
  templateId: string,
  status: EmailStatus,
  errorMessage?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/email_logs`, {
    method: "POST",
    headers: { ...getSupabaseHeaders(serviceRoleKey), Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      email_type: emailType,
      template_id: templateId,
      status,
      error_message: errorMessage || null,
      metadata: metadata || null,
    }),
  });
}

/**
 * Send transactional email and log it (duplicate-protected).
 */
export async function sendTransactionalEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  email: string,
  emailType: EmailType,
  templateId: string,
  emailData: Record<string, string>
): Promise<boolean> {
  const alreadySent = await wasEmailSentToday(supabaseUrl, serviceRoleKey, userId, emailType);
  if (alreadySent) {
    console.log(`[Reminder] Skipping ${emailType} - already sent today for user ${userId}`);
    return false;
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      to: email,
      templateId,
      data: emailData,
      attachments: [],
    }),
  });

  if (res.ok) {
    await logEmailSent(supabaseUrl, serviceRoleKey, userId, emailType, templateId, "sent", undefined, emailData);
    return true;
  }

  const errText = await res.text();
  await logEmailSent(supabaseUrl, serviceRoleKey, userId, emailType, templateId, "failed", errText, emailData);
  console.error(`[Reminder] Failed to send ${emailType}: ${errText}`);
  return false;
}

