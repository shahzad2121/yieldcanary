import { stripePromise } from './client';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/** Opens the Stripe Customer Portal (manage subscription, payment method, invoices). */
export async function redirectToManageSubscription(): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not set');
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    toast({ variant: 'destructive', title: 'Sign in required', description: 'Please sign in to manage your subscription.' });
    return;
  }
  const response = await fetch(`${supabaseUrl}/functions/v1/create-portal-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ returnUrl: window.location.origin + '/' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error ?? 'Failed to open billing portal';
    toast({ variant: 'destructive', title: 'Error', description: message });
    return;
  }
  if (data.url) {
    window.location.href = data.url;
  } else {
    toast({ variant: 'destructive', title: 'Error', description: 'No billing portal URL returned.' });
  }
}

/** Cancel reason values sent to the API (must match backend). */
export const CANCEL_REASON_API_VALUES = [
  'too_expensive',
  'not_enough_value',
  'not_using_enough',
  'found_better_alternative',
  'other',
] as const;
export type CancelReasonValue = (typeof CANCEL_REASON_API_VALUES)[number];

export const CANCEL_REASON_LABELS: Record<CancelReasonValue, string> = {
  too_expensive: 'Too expensive',
  not_enough_value: 'Not enough value / features',
  not_using_enough: 'Not using it enough',
  found_better_alternative: 'Found a better alternative',
  other: 'Other',
};

export interface CancelSubscriptionParams {
  cancel_reason: CancelReasonValue;
  cancel_reason_other?: string;
}

/** Call cancel-subscription-with-reason Edge Function. Returns error message or null on success. */
export async function cancelSubscriptionWithReason(params: CancelSubscriptionParams): Promise<string | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return 'VITE_SUPABASE_URL is not set';
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return 'Please sign in to cancel your subscription.';
  const body: { cancel_reason: string; cancel_reason_other?: string } = {
    cancel_reason: params.cancel_reason,
  };
  if (params.cancel_reason === 'other' && params.cancel_reason_other?.trim()) {
    body.cancel_reason_other = params.cancel_reason_other.trim();
  }
  const response = await fetch(`${supabaseUrl}/functions/v1/cancel-subscription-with-reason`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return (data.error as string) || 'Failed to cancel subscription';
  return null;
}

export type PricingPlan = 'basic_monthly' | 'basic_yearly' | 'advanced_monthly' | 'advanced_yearly' | 'one_dollar';

const PRICE_IDS: Record<PricingPlan, string> = {
  basic_monthly: import.meta.env.VITE_BASIC_MONTHLY_PRICE || '',
  basic_yearly: import.meta.env.VITE_BASIC_YEARLY_PRICE || '',
  advanced_monthly: import.meta.env.VITE_ADVANCED_MONTHLY_PRICE || '',
  advanced_yearly: import.meta.env.VITE_ADVANCED_YEARLY_PRICE || '',
  one_dollar:
    import.meta.env.VITE_HALF_DOLLAR_PRICE ||
    
    '',
};

export async function redirectToCheckout(plan: PricingPlan, email?: string) {
  try {
    const stripe = await stripePromise;
    
    if (!stripe) {
      throw new Error('Stripe failed to load');
    }

    const priceId = PRICE_IDS[plan];
    
    if (!priceId) {
      throw new Error(`Price ID not found for plan: ${plan}. Please check your environment variables.`);
    }

    // Call the Supabase Edge Function to create checkout session
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is not set');
    }

    // Get current session for authorization
    const { data: { session } } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if session exists
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // Tolt affiliate: send referral ID so backend can set 30-day trial and Stripe metadata
    const toltReferral =
      typeof (window as unknown as { tolt_referral?: string }).tolt_referral === 'string'
        ? (window as unknown as { tolt_referral: string }).tolt_referral.trim()
        : '';
    const body: { priceId: string; email?: string; successUrl: string; cancelUrl: string; tolt_referral?: string } = {
      priceId,
      email,
      successUrl: `${window.location.origin}/?payment=success`,
      cancelUrl: `${window.location.origin}/?payment=cancelled`,
    };
    if (toltReferral) body.tolt_referral = toltReferral;

    const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create checkout session');
    }

    const { sessionId } = await response.json();

    if (!sessionId) {
      throw new Error('No session ID returned from server');
    }

    const { error } = await stripe.redirectToCheckout({ sessionId });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Checkout error:', error);
    const message = error instanceof Error ? error.message : 'Failed to start checkout';
    toast({
      variant: 'destructive',
      title: 'Checkout Error',
      description: message,
    });
    throw error;
  }
}

export function getPlanName(plan: PricingPlan): string {
  switch (plan) {
    case 'basic_monthly':
      return 'Basic - Monthly';
    case 'basic_yearly':
      return 'Basic - Yearly';
    case 'advanced_monthly':
      return 'Advanced - Monthly';
    case 'advanced_yearly':
      return 'Advanced - Yearly';
    case 'one_dollar':
      return 'One-Time Access';
    default:
      return 'Unknown Plan';
  }
}

export function getPlanPrice(plan: PricingPlan): string {
  switch (plan) {
    case 'basic_monthly':
      return '$9/month';
    case 'basic_yearly':
      return '$89/year';
    case 'advanced_monthly':
      return '$19/month';
    case 'advanced_yearly':
      return '$189/year';
    case 'one_dollar':
      return '$0.50';
    default:
      return '$0';
  }
}
