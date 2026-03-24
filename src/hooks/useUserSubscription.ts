import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserSubscription {
  id: string;
  email: string;
  name: string | null;
  is_paid: boolean;
  subscription_tier: string | null;
  subscription_start: string | null;
  subscription_end: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  cancel_at_period_end?: boolean | null;
  cancels_at?: string | null;
  newsletter_tier?: string | null;
  created_at: string;
  updated_at: string;
}

/** True when backend says user is on trial (subscription_status === 'trialing'). Active = not trial even if trial_ends_at is still in future. */
export function isOnTrial(u: UserSubscription | null): boolean {
  if (!u?.is_paid) return false;
  if (u.subscription_status === 'active') return false;
  if (u.subscription_status === 'trialing') return true;
  if (!u.trial_ends_at) return false;
  return new Date(u.trial_ends_at) > new Date();
}

export function useUserSubscription() {
  const [user, setUser] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isTrialing = isOnTrial(user);

  const fetchUserSubscription = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        setUser(null);
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();

      if (queryError && queryError.code !== 'PGRST116') {
        throw queryError;
      }

      if (data) {
        const cast = data as UserSubscription;
        console.log('[useUserSubscription] Loaded user subscription row', {
          email: cast.email,
          subscription_tier: cast.subscription_tier,
          cancel_at_period_end: cast.cancel_at_period_end,
          cancels_at: cast.cancels_at,
          newsletter_tier: cast.newsletter_tier,
        });
        setUser(cast);
      } else {
        setUser(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch subscription';
      setError(errorMessage);
      console.error('Subscription fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserSubscription();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserSubscription();
    });

    return () => subscription?.unsubscribe();
  }, []);

  const subscriptionStatus = user?.subscription_status ?? null;
  const subscriptionTier = user?.subscription_tier ?? null;
  /** Weekly email is included with Basic/Advanced while subscription is active or trialing */
  const hasBundledNewsletterAccess =
    (subscriptionTier === 'basic' || subscriptionTier === 'advanced') &&
    (subscriptionStatus === 'active' || subscriptionStatus === 'trialing');

  return {
    user,
    loading,
    error,
    isTrialing,
    trialEndsAt: user?.trial_ends_at ?? null,
    cancelAtPeriodEnd: user?.cancel_at_period_end ?? false,
    cancelsAt: user?.cancels_at ?? null,
    /** Legacy newsletter-only SKU; unused now that newsletter is bundled */
    newsletterTier: user?.newsletter_tier ?? null,
    hasBundledNewsletterAccess,
    refetch: fetchUserSubscription,
  };
}
