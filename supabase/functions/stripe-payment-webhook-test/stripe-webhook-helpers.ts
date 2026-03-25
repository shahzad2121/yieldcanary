/**
 * Stripe Webhook Helper Functions
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

/**
 * Get Supabase configuration from environment
 */
export function getSupabaseConfig() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SERVICE_ROLE_KEY must be set");
  }
  
  return { supabaseUrl, serviceRoleKey };
}

/**
 * Get common Supabase REST API headers
 */
export function getSupabaseHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

// ============================================
// User Lookup Functions
// ============================================

/**
 * Get user by email from Supabase
 */
export async function getUserByEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  select?: string
): Promise<User | null> {
  const selectParam = select ? `&select=${select}` : "";
  const res = await fetch(
    `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}${selectParam}`,
    {
      headers: getSupabaseHeaders(serviceRoleKey),
    }
  );
  
  if (!res.ok) {
    console.error(`[Helper] Failed to fetch user by email: ${res.status}`);
    return null;
  }
  
  const users = await res.json();
  return users?.[0] || null;
}

/**
 * Get user ID by email (lightweight version)
 */
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

/**
 * Map Stripe subscription status to our database subscription_status
 */
export function mapStripeStatusToSubscriptionStatus(
  stripeStatus: string,
  trialEnd: number | null | undefined,
  subscriptionEnd: number | null | undefined
): SubscriptionStatus {
  // Check if subscription has expired
  if (subscriptionEnd && subscriptionEnd * 1000 < Date.now()) {
    return 'canceled';
  }
  
  // Map Stripe statuses to our statuses
  switch (stripeStatus) {
    case 'trialing':
      // Check if trial is still active
      if (trialEnd && trialEnd * 1000 > Date.now()) {
        return 'trialing';
      }
      // Trial ended but subscription might be active
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
// Email Logging Functions
// ============================================

/**
 * Check if email was sent today (prevents duplicates)
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
    {
      headers: getSupabaseHeaders(serviceRoleKey),
    }
  );
  
  if (!res.ok) {
    console.warn(`[Helper] Failed to check email log: ${res.status}`);
    return false; // Assume not sent if check fails (fail open)
  }
  
  const logs = await res.json();
  return logs && logs.length > 0;
}

/**
 * Check if email was sent in the last N hours (for rate limiting)
 */
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
    {
      headers: getSupabaseHeaders(serviceRoleKey),
    }
  );
  
  if (!res.ok) {
    console.warn(`[Helper] Failed to check email log: ${res.status}`);
    return false;
  }
  
  const logs = await res.json();
  return logs && logs.length > 0;
}

/**
 * Log email sent to email_logs table
 */
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
    headers: {
      ...getSupabaseHeaders(serviceRoleKey),
      Prefer: 'return=minimal',
    },
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
// Email Sending Functions
// ============================================

/**
 * Send transactional email and log it (all-in-one helper)
 */
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
    checkDuplicate?: boolean; // Check if already sent today (default: true)
    rateLimitHours?: number; // Rate limit in hours (default: 24 for payment_failed, 0 for others)
  }
): Promise<boolean> {
  const { checkDuplicate = true, rateLimitHours } = options || {};
  
  // Determine rate limit hours based on email type
  const defaultRateLimitHours = emailType === 'payment_failed' ? 24 : 0;
  const limitHours = rateLimitHours !== undefined ? rateLimitHours : defaultRateLimitHours;
  
  // Check for duplicates/rate limiting
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
  
  // Send email via send-email edge function
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
    // Log success
    await logEmailSent(supabaseUrl, serviceRoleKey, userId, emailType, templateId, 'sent', undefined, emailData);
    console.log(`[Helper] ✅ ${emailType} sent and logged for user ${userId}`);
    return true;
  } else {
    // Log failure
    const errText = await emailRes.text();
    await logEmailSent(supabaseUrl, serviceRoleKey, userId, emailType, templateId, 'failed', errText, emailData);
    console.error(`[Helper] ❌ Failed to send ${emailType}: ${errText}`);
    return false;
  }
}

// ============================================
// User Update Functions
// ============================================

/**
 * Update user subscription status from Stripe subscription data
 */
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
  
  // Get price ID and map to tier
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const newTier = priceId ? priceIdToTier(priceId) : "basic";
  
  // Fetch full subscription details from Stripe API if needed
  let fullSubscription = subscription;
  if (subscriptionId) {
    try {
      const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "";
      const subscriptionRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
        },
      });
      if (subscriptionRes.ok) {
        fullSubscription = await subscriptionRes.json();
      }
    } catch (subError) {
      console.error("[Helper] Error fetching subscription:", subError);
    }
  }
  
  // Extract dates
  const periodStart = fullSubscription.current_period_start || null;
  const periodEnd = fullSubscription.current_period_end || null;
  const trialStart = fullSubscription.trial_start ?? null;
  const trialEnd = fullSubscription.trial_end ?? null;
  
  const subscriptionStart = periodStart ? new Date(periodStart * 1000).toISOString() : null;
  const subscriptionEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
  const trialEndsAt = trialEnd ? new Date(trialEnd * 1000).toISOString() : null;
  
  // Map Stripe status to our subscription_status
  const subStatus = fullSubscription.status || subscription.status || "";
  const subscriptionStatus = mapStripeStatusToSubscriptionStatus(
    subStatus,
    trialEnd,
    periodEnd
  );
  
  // Determine if trial converted to paid
  const isActiveOrTrialing = subStatus === "active" || subStatus === "trialing";
  const wasTrialing = trialEnd && trialEnd * 1000 > Date.now() - 7 * 24 * 60 * 60 * 1000; // Trial ended in last 7 days
  const trialConverted = isActiveOrTrialing && wasTrialing && subStatus === "active";
  
  // Update user
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

  if (subStatus === "trialing" || trialEnd != null) {
    updateData.has_used_trial = true;
  }
  
  // Set trial_converted_to_paid if this is a conversion
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

/**
 * Downgrade user to free tier (when subscription is canceled/deleted)
 */
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
        cancel_at_period_end: false,
        cancels_at: null,
        newsletter_tier: "none",
        stripe_newsletter_subscription_id: null,
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

/**
 * Create a price ID to tier mapper function
 * Pass in your price IDs (test or production)
 */
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
    return "basic"; // default
  };
}

// ============================================
// Stripe Customer Email Lookup
// ============================================

/**
 * Get customer email from Stripe by customer ID
 */
export async function getStripeCustomerEmail(
  customerId: string,
  stripeSecret: string
): Promise<string | null> {
  try {
    const stripeRes = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
      },
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
