import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_INSIGHTS_SECTION_ORDER,
  getStoredSectionOrder,
  setStoredSectionOrder,
  normalizeSectionOrder,
  INSIGHTS_SECTION_ORDER_PREFERENCE_KEY,
  type InsightsSectionId,
} from '@/components/insights/insightsSectionConfig';

const QUERY_KEY = ['insights_section_order'] as const;

async function fetchSectionOrder(email: string | null): Promise<InsightsSectionId[]> {
  if (!email) {
    return getStoredSectionOrder();
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .select('value')
    .eq('user_email', email)
    .eq('preference_key', INSIGHTS_SECTION_ORDER_PREFERENCE_KEY)
    .maybeSingle();

  if (error) {
    return getStoredSectionOrder();
  }

  if (data?.value != null) {
    return normalizeSectionOrder(data.value);
  }

  return getStoredSectionOrder();
}

export function useInsightsSectionOrder() {
  const queryClient = useQueryClient();

  const {
    data: sectionOrder,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<InsightsSectionId[]> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const email = session?.user?.email ?? null;
      return fetchSectionOrder(email);
    },
    placeholderData: [...DEFAULT_INSIGHTS_SECTION_ORDER],
  });

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const saveMutation = useMutation({
    mutationFn: async (order: InsightsSectionId[]) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const email = session?.user?.email ?? null;

      setStoredSectionOrder(order);

      if (email) {
        const { error: upsertError } = await supabase
          .from('user_preferences')
          .upsert(
            {
              user_email: email,
              preference_key: INSIGHTS_SECTION_ORDER_PREFERENCE_KEY,
              value: order,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_email,preference_key' }
          );

        if (upsertError) throw upsertError;
      }

      return order;
    },
    onSuccess: (order) => {
      queryClient.setQueryData(QUERY_KEY, order);
    },
  });

  const setSectionOrder = useCallback(
    (order: InsightsSectionId[]) => {
      saveMutation.mutate(order);
    },
    [saveMutation]
  );

  const order = sectionOrder ?? getStoredSectionOrder();

  return {
    sectionOrder: order,
    setSectionOrder,
    refetch,
    isLoading,
    isSaving: saveMutation.isPending,
    error: error ?? saveMutation.error,
  };
}
