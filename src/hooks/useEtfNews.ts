import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EtfNewsItem {
  symbol: string;
  publishedDate: string;
  publisher: string | null;
  title: string;
  site: string | null;
  url: string;
}

interface UseEtfNewsResult {
  news: EtfNewsItem[];
  loading: boolean;
  error: string | null;
}

export function useEtfNews(ticker: string | null): UseEtfNewsResult {
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["etf-news", ticker],
    enabled: !!ticker,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("etf-news", {
        body: { ticker },
      });

      if (error) {
        throw error;
      }

      if (!data || !data.success || !Array.isArray(data.news)) {
        return [] as EtfNewsItem[];
      }

      return data.news.map((n: any) => ({
        symbol: typeof n.symbol === "string" ? n.symbol : ticker ?? "",
        publishedDate:
          typeof n.publishedDate === "string" ? n.publishedDate : "",
        publisher: typeof n.publisher === "string" ? n.publisher : null,
        title: typeof n.title === "string" ? n.title : "",
        site: typeof n.site === "string" ? n.site : null,
        url: typeof n.url === "string" ? n.url : "",
      })) as EtfNewsItem[];
    },
    // Treat news as fresh for 30 minutes; keep it in cache for 2 hours.
    staleTime: 1000 * 60 * 30,
    cacheTime: 1000 * 60 * 120,
    refetchOnWindowFocus: false,
  });

  return {
    news: data ?? [],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
  };
}

