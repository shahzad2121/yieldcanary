import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEtfDeepDive } from "@/context/EtfDeepDiveContext";
import { supabase } from "@/integrations/supabase/client";
import { useEtfNews } from "@/hooks/useEtfNews";
import { formatMMDDYYYY, formatNewsDateTime } from "@/lib/formatDeepDiveDate";

interface Notice19a1 {
  id: string;
  notice_date: string | null;
  effective_date: string | null;
  roc_percent: number | null;
}

interface NewsItem {
  publishedDate: string;
  title: string;
  publisher: string | null;
  site: string | null;
  url: string;
}

export default function NewsFilingsTab() {
  const { baseEtf, ticker } = useEtfDeepDive();
  const { news, loading: loadingNews, error: newsError } = useEtfNews(ticker);

  const [latestNotice, setLatestNotice] = useState<Notice19a1 | null>(null);
  const [loadingNotice, setLoadingNotice] = useState(false);
  const [noticeError, setNoticeError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLatestNotice = async () => {
      if (!baseEtf?.id) {
        setLatestNotice(null);
        return;
      }

      setLoadingNotice(true);
      setNoticeError(null);

      try {
        const { data, error } = await supabase
          .from("notices_19a1")
          .select("id, notice_date, effective_date, roc_percent")
          .eq("ticker_id", baseEtf.id)
          .order("notice_date", { ascending: false })
          .limit(1);

        if (error) throw error;

        setLatestNotice(data && data.length > 0 ? (data[0] as Notice19a1) : null);
      } catch (e) {
        setNoticeError(
          e instanceof Error ? e.message : "Unable to load ROC notice for this ETF.",
        );
        setLatestNotice(null);
      } finally {
        setLoadingNotice(false);
      }
    };

    fetchLatestNotice();
  }, [baseEtf?.id]);

  const formatPercent = (value: number | null) => {
    if (value == null) return "—";
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filings & Disclosures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <p className="text-muted-foreground">
            YieldCanary maintains an internal 19a-1-style ROC record for each ETF based on
            our model of NAV erosion and distributions. This is{" "}
            <span className="font-medium text-foreground">
              not an official tax document
            </span>
            ; always refer to the issuer&apos;s 19a-1 notices for formal tax
            characterization.
          </p>

          {loadingNotice ? (
            <div className="rounded-md bg-muted/40 px-2 py-1.5 text-muted-foreground">
              Loading ROC notice…
            </div>
          ) : noticeError ? (
            <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-destructive">
              {noticeError}
            </div>
          ) : latestNotice ? (
            <div className="rounded-md bg-muted/40 px-3 py-2">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Latest YC ROC snapshot
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Notice date: {formatMMDDYYYY(latestNotice.notice_date)}
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs text-foreground">
                    ROC % (estimated):{" "}
                    <span className="font-medium">
                      {formatPercent(latestNotice.roc_percent)}
                    </span>
                  </span>
                  {latestNotice.effective_date && (
                    <span className="text-[11px] text-muted-foreground">
                      Effective as of {formatMMDDYYYY(latestNotice.effective_date)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-muted/40 px-2 py-1.5 text-muted-foreground">
              No YC ROC notice is available yet for this ETF.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent News</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs max-h-64 overflow-y-auto pr-1">
          {loadingNews ? (
            <div className="rounded-md bg-muted/40 px-2 py-1.5 text-muted-foreground">
              Loading news…
            </div>
          ) : newsError ? (
            <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-destructive">
              {newsError}
            </div>
          ) : news.length === 0 ? (
            <div className="rounded-md bg-muted/40 px-2 py-1.5 text-muted-foreground">
              No recent news available for this ETF.
            </div>
          ) : (
            <ul className="space-y-2">
              {news.map((item) => (
                <li
                  key={`${item.symbol}-${item.publishedDate}-${item.url}`}
                  className="rounded-md bg-muted/40 px-3 py-2"
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
                  >
                    {item.title || "View article"}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{formatNewsDateTime(item.publishedDate)}</span>
                    {item.publisher && <span>• {item.publisher}</span>}
                    {!item.publisher && item.site && <span>• {item.site}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

