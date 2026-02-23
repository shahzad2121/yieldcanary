/**
 * Stripe Webhook Helper Functions (PRODUCTION)
 * Shared utilities for handling Stripe webhook events and email tracking
 */

// ============================================
// Types
// ============================================

export type SubscriptionStatus = 'free' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
export type EmailType = 'trial_started' | 'trial_ending_reminder' | 'trial_converted_to_paid' | 'payment_failed' | 'subscription_cancelled';
export type EmailStatus = 'sent' | 'failed' | 'bounced' | 'delivered';

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string | { id: string };
  items?: {
    data?: Array<{
      price?: { id: string };
    }>;
  };
  trial_start?: number | null;
  trial_end?: number | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
  subscription_tier?: string | null;
  subscription_status?: SubscriptionStatus;
  trial_converted_to_paid?: boolean;
}

// ============================================
// Configuration
// ============================================

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

// ============================================
// User Lookup
// ============================================

export async function getUserByEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  select?: string
): Promise<User | null> {
  const selectParam = select ? `&select=${select}` : "";
  const res = await fetch(
    `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}${selectParam}`,
    { headers: getSupabaseHeaders(serviceRoleKey) }
  );

  if (!res.ok) {
    console.error(`[Helper] Failed to fetch user by email: ${res.status}`);
    return null;
  }

  const users = await res.json();
  return users?.[0] || null;
}

export async function getUserIdByEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string
): Promise<string | null> {
  const user = await getUserByEmail(supabaseUrl, serviceRoleKey, email, "id");
  return user?.id || null;
}

// ============================================
// Subscription Status Mapping
// ============================================

export function mapStripeStatusToSubscriptionStatus(
  stripeStatus: string,
  trialEnd: number | null | undefined,
  subscriptionEnd: number | null | undefined
): SubscriptionStatus {
  if (subscriptionEnd && subscriptionEnd * 1000 < Date.now()) {
    return 'canceled';
  }

  switch (stripeStatus) {
    case 'trialing':
      if (trialEnd && trialEnd * 1000 > Date.now()) return 'trialing';
      return 'active';
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    case 'incomplete':
      return 'unpaid';
    default:
      return 'free';
  }
}

// ============================================
// Email Logging
// ============================================

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

  if (!res.ok) {
    console.warn(`[Helper] Failed to check email log: ${res.status}`);
    return false;
  }

  const logs = await res.json();
  return logs && logs.length > 0;
}

export async function wasEmailSentRecently(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  emailType: EmailType,
  hours: number = 24
): Promise<boolean> {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${supabaseUrl}/rest/v1/email_logs?user_id=eq.${userId}&email_type=eq.${emailType}&status=in.(sent,delivered)&sent_at=gte.${cutoffTime}`,
    { headers: getSupabaseHeaders(serviceRoleKey) }
  );

  if (!res.ok) {
    console.warn(`[Helper] Failed to check email log: ${res.status}`);
    return false;
  }

  const logs = await res.json();
  return logs && logs.length > 0;
}

export async function logEmailSent(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  emailType: EmailType,
  templateId: string,
  status: EmailStatus = 'sent',
  errorMessage?: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/rest/v1/email_logs`, {
    method: 'POST',
    headers: { ...getSupabaseHeaders(serviceRoleKey), Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      email_type: emailType,
      template_id: templateId,
      status,
      error_message: errorMessage || null,
      metadata: metadata || null,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[Helper] Failed to log email: ${errText}`);
    return false;
  }

  return true;
}

// ============================================
// Email Sending
// ============================================

export async function sendTransactionalEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  email: string,
  emailType: EmailType,
  templateId: string,
  emailData: Record<string, string>,
  attachments: Array<{ filename: string; content: string }> = [],
  options?: {
    checkDuplicate?: boolean;
    rateLimitHours?: number;
  }
): Promise<boolean> {
  const { checkDuplicate = true, rateLimitHours } = options || {};
  const defaultRateLimitHours = emailType === 'payment_failed' ? 24 : 0;
  const limitHours = rateLimitHours !== undefined ? rateLimitHours : defaultRateLimitHours;

  if (checkDuplicate) {
    if (limitHours > 0) {
      const alreadySent = await wasEmailSentRecently(supabaseUrl, serviceRoleKey, userId, emailType, limitHours);
      if (alreadySent) {
        console.log(`[Helper] Skipping ${emailType} - sent within last ${limitHours} hours for user ${userId}`);
        return false;
      }
    } else {
      const alreadySent = await wasEmailSentToday(supabaseUrl, serviceRoleKey, userId, emailType);
      if (alreadySent) {
        console.log(`[Helper] Skipping ${emailType} - already sent today for user ${userId}`);
        return false;
      }
    }
  }

  const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      to: email,
      templateId,
      data: emailData,
      attachments,
    }),
  });

  if (emailRes.ok) {
    await logEmailSent(supabaseUrl, serviceRoleKey, userId, emailType, templateId, 'sent', undefined, emailData);
    console.log(`[Helper] ✅ ${emailType} sent and logged for user ${userId}`);
    return true;
  } else {
    const errText = await emailRes.text();
    await logEmailSent(supabaseUrl, serviceRoleKey, userId, emailType, templateId, 'failed', errText, emailData);
    console.error(`[Helper] ❌ Failed to send ${emailType}: ${errText}`);
    return false;
  }
}

// ============================================
// User Update
// ============================================

export async function updateUserSubscriptionFromStripe(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  subscription: StripeSubscription,
  priceIdToTier: (priceId: string) => string
): Promise<boolean> {
  const subscriptionId = subscription.id;
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;

  const priceId = subscription.items?.data?.[0]?.price?.id;
  const newTier = priceId ? priceIdToTier(priceId) : "basic";

  let fullSubscription = subscription;
  if (subscriptionId) {
    try {
      const secret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
      const subscriptionRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (subscriptionRes.ok) {
        fullSubscription = await subscriptionRes.json();
      }
    } catch (subError) {
      console.error("[Helper] Error fetching subscription:", subError);
    }
  }

  const periodStart = fullSubscription.current_period_start || null;
  const periodEnd = fullSubscription.current_period_end || null;
  const trialStart = fullSubscription.trial_start ?? null;
  const trialEnd = fullSubscription.trial_end ?? null;

  const subscriptionStart = periodStart ? new Date(periodStart * 1000).toISOString() : null;
  const subscriptionEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
  const trialEndsAt = trialEnd ? new Date(trialEnd * 1000).toISOString() : null;

  const subStatus = fullSubscription.status || subscription.status || "";
  const subscriptionStatus = mapStripeStatusToSubscriptionStatus(
    subStatus,
    trialEnd,
    periodEnd
  );

  const isActiveOrTrialing = subStatus === "active" || subStatus === "trialing";
  const wasTrialing = trialEnd && trialEnd * 1000 > Date.now() - 7 * 24 * 60 * 60 * 1000;
  const trialConverted = isActiveOrTrialing && wasTrialing && subStatus === "active";

  const updateData: Record<string, any> = {
    is_paid: isActiveOrTrialing,
    subscription_tier: newTier,
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    subscription_start: subscriptionStart,
    subscription_end: subscriptionEnd,
    trial_ends_at: trialEndsAt,
    subscription_status: subscriptionStatus,
    updated_at: new Date().toISOString(),
  };

  if (trialConverted) {
    updateData.trial_converted_to_paid = true;
  }

  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: {
        ...getSupabaseHeaders(serviceRoleKey),
        Prefer: "return=representation",
      },
      body: JSON.stringify(updateData),
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    console.error(`[Helper] Failed to update user subscription: ${errText}`);
    return false;
  }

  return true;
}

export async function downgradeUserToFree(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string
): Promise<boolean> {
  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: {
        ...getSupabaseHeaders(serviceRoleKey),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        is_paid: false,
        subscription_tier: "free",
        stripe_subscription_id: null,
        subscription_start: null,
        subscription_end: null,
        trial_ends_at: null,
        subscription_status: "free",
        trial_converted_to_paid: false,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    console.error(`[Helper] Failed to downgrade user: ${errText}`);
    return false;
  }

  return true;
}

// ============================================
// Price ID to Tier Mapping
// ============================================

export function createPriceIdToTierMapper(
  basicMonthlyPrice: string,
  basicYearlyPrice: string,
  advancedMonthlyPrice: string,
  advancedYearlyPrice: string
): (priceId: string) => string {
  return (priceId: string): string => {
    if (priceId === advancedMonthlyPrice || priceId === advancedYearlyPrice) {
      return "advanced";
    } else if (priceId === basicMonthlyPrice || priceId === basicYearlyPrice) {
      return "basic";
    }
    return "basic";
  };
}

// ============================================
// Stripe Customer Email Lookup
// ============================================

export async function getStripeCustomerEmail(
  customerId: string,
  stripeSecret: string
): Promise<string | null> {
  try {
    const stripeRes = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${stripeSecret}` },
    });

    if (stripeRes.ok) {
      const customer = await stripeRes.json();
      return customer.email || null;
    }
  } catch (error) {
    console.error("[Helper] Error fetching Stripe customer:", error);
  }

  return null;
}

