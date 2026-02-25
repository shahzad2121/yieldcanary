import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const WELCOME_BANNER_PREFERENCE_KEY = 'welcome_banner_dismissed';
const QUERY_KEY = ['welcome_banner'] as const;

export function useWelcomeBanner() {
  const queryClient = useQueryClient();
  const [shouldShow, setShouldShow] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const email = session?.user?.email ?? null;

      if (!email) {
        setShouldShow(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_preferences')
        .select('value')
        .eq('user_email', email)
        .eq('preference_key', WELCOME_BANNER_PREFERENCE_KEY)
        .maybeSingle();

      if (error) {
        setShouldShow(false);
        return;
      }

      setShouldShow(data?.value != null ? false : true);
    };

    check();
  }, []);

  const dismiss = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const email = session?.user?.email ?? null;

    if (!email) {
      setShouldShow(false);
      return;
    }

    const { error } = await supabase.from('user_preferences').upsert(
      {
        user_email: email,
        preference_key: WELCOME_BANNER_PREFERENCE_KEY,
        value: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email,preference_key' }
    );

    if (!error) setShouldShow(false);
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  return {
    shouldShow: shouldShow === true,
    isLoading: shouldShow === null,
    dismiss,
  };
}
