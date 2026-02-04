import { stripePromise } from './client';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
