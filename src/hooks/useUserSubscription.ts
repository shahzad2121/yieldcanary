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
  trial_ends_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** True when user is paid and trial_ends_at is in the future. */
export function isOnTrial(u: UserSubscription | null): boolean {
  if (!u?.is_paid || !u.trial_ends_at) return false;
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
        setUser(data as UserSubscription);
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

  return { user, loading, error, isTrialing, trialEndsAt: user?.trial_ends_at ?? null, refetch: fetchUserSubscription };
}
