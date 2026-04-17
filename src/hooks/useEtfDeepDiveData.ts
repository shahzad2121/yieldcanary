import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ETF } from "@/types/etf";
import { formatMMDDYYYY } from "@/lib/formatDeepDiveDate";

type Timeframe = "1M" | "3M" | "6M" | "1Y" | "ALL";

interface PricePoint {
  date: string;
  close: number | null;
  volume: number | null;
}

interface DividendEvent {
  declarationDate: string | null;
  exDate: string | null;
  recordDate: string | null;
  paymentDate: string | null;
  amount: number;
}

interface HoldingItem {
  symbol: string | null;
  name: string | null;
  weight: number | null;
  sector: string | null;
}

interface SectorWeight {
  sector: string;
  weight: number;
}

interface EtfDeepDiveRaw {
  success: boolean;
  error?: string;
  ticker?: string;
  prices?: PricePoint[];
  dividends?: DividendEvent[];
  holdings?: HoldingItem[];
  sectors?: SectorWeight[];
}

interface AggregatedDividendBucket {
  label: string;
  startDate: string;
  totalAmount: number;
  trueIncomePortion: number;
  rocPortion: number;
  cumulativeYield: number;
}

interface DividendAnalytics {
  monthOverMonthChangePct: number | null;
  yearOverYearChangePct: number | null;
}

const AVG_DAILY_VOLUME_DAYS = 30;
const TRADING_DAYS_1Y = 252;
const SEC_YIELD_DAYS = 30;

interface UseEtfDeepDiveDataResult {
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  loading: boolean;
  error: string | null;
  priceSeries: PricePoint[];
  priceSeriesFiltered: PricePoint[];
  /** 30-day average daily volume (from last 30 days of price series), or null if insufficient data */
  avgDailyVolume: number | null;
  /** SEC-style 30-day annualized yield (decimal, e.g. 0.085 = 8.5%), or null */
  secYield30d: number | null;
  /** 1-year annualized volatility (decimal, e.g. 0.22 = 22%), or null */
  volatility1y: number | null;
  dividendEvents: DividendEvent[];
  dividendBuckets: AggregatedDividendBucket[];
  dividendAnalytics: DividendAnalytics;
  holdingsTop10: HoldingItem[];
  sectors: SectorWeight[];
}

// Same DB -> ETF mapping shape used in list screens; keeps Deep Dive consistent across entry points.
function transformRowToETF(row: any): ETF {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    issuer: row.issuer,
    inceptionDate: row.inception_date,
    latestAdjClose: row.latest_adj_close,
    latestDate: row.latest_date,
    priceAvg90d: row.price_avg_90d ?? null,
    headlineYieldTTM: row.headline_yield_ttm,
    advertisedYield: row.advertised_yield ?? null,
    rocPercent: row.roc_latest,
    rocDate: row.roc_date,
    trueIncomeYield: row.true_income_yield,
    deathClock: row.death_clock_years ? `${row.death_clock_years.toFixed(1)} years` : "N/A",
    canaryStatus: row.canary_health as "Healthy" | "Dying" | "Dead",
    aum: row.aum,
    expenseRatio: row.expense_ratio,
    beta: row.beta ?? null,
    description: row.description ?? null,
    website: row.website ?? null,
    payoutFrequency: row.payout_frequency as "Weekly" | "Monthly" | "Quarterly" | null,
    price1YAgo: row.price_1y_ago,
    dividendsLast12Mo: row.dividends_last_12mo,
    priceYTDStart: row.price_ytd_start,
    dividendsYTD: row.dividends_ytd,
    priceAtInception: row.price_at_inception,
    dividendsSinceInception: row.dividends_since_inception,
    totalReturn1Y: row.total_return_1y,
    totalReturnYTD: row.total_return_ytd,
    totalReturnSinceInception: row.total_return_inception,
    spentDividendsReturn1Y: row.spent_dividends_return_1y,
    spentDividendsReturnYTD: row.spent_dividends_return_ytd,
    spentDividendsReturnSinceInception: row.spent_dividends_return_inception,
    takeHomeReturn1Y: row.take_home_return_1y,
    takeHomeReturnYTD: row.take_home_return_ytd,
    takeHomeReturnSinceInception: row.take_home_return_inception,
    takeHomeCashReturn1Y: row.take_home_cash_return_1y,
    takeHomeCashReturnYTD: row.take_home_cash_return_ytd,
    takeHomeCashReturnSinceInception: row.take_home_cash_return_inception,
    lastMonthDistribution: row.last_month_distribution,
  };
}

export function useEtfDeepDiveData(ticker: string | null, baseEtf: ETF | null): UseEtfDeepDiveDataResult {
  const [timeframe, setTimeframe] = useState<Timeframe>("6M");
  const queryClient = useQueryClient();

  const {
    data: fetchedBaseEtf,
    error: baseEtfError,
  } = useQuery<ETF | null>({
    queryKey: ["etf-base-by-ticker", ticker],
    enabled: !!ticker && !baseEtf,
    queryFn: async () => {
      if (!ticker) return null;

      // Reuse cached ETF list first for instant parity with Dashboard-open path.
      const cachedEtfs = queryClient.getQueryData<ETF[]>(["etfs"]);
      const fromCache =
        cachedEtfs?.find((e) => e.ticker.toUpperCase() === ticker.toUpperCase()) ?? null;
      if (fromCache) return fromCache;

      const { data, error } = await supabase
        .from("etfs")
        .select("*")
        .ilike("ticker", ticker.trim())
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;

      return transformRowToETF(data);
    },
    staleTime: 1000 * 60 * 10,
  });

  const effectiveBaseEtf = baseEtf ?? fetchedBaseEtf ?? null;

  const {
    data,
    isLoading,
    error,
  } = useQuery<EtfDeepDiveRaw>({
    queryKey: ["etf-deep-dive", ticker],
    enabled: !!ticker,
    queryFn: async () => {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("etf-deep-dive", {
        body: { ticker },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      return fnData as EtfDeepDiveRaw;
    },
    staleTime: 1000 * 60 * 10,
  });

  const priceSeries = useMemo<PricePoint[]>(() => {
    if (!data || !data.success || !Array.isArray(data.prices)) return [];
    return [...data.prices].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const minDate = useMemo<Date | null>(() => {
    if (priceSeries.length === 0) return null;
    return new Date(priceSeries[0].date);
  }, [priceSeries]);

  const priceSeriesFiltered = useMemo<PricePoint[]>(() => {
    if (priceSeries.length === 0) return [];
    if (timeframe === "ALL" || !minDate) return priceSeries;

    const end = new Date(priceSeries[priceSeries.length - 1].date);
    const start = new Date(end);

    if (timeframe === "1M") {
      start.setMonth(start.getMonth() - 1);
    } else if (timeframe === "3M") {
      start.setMonth(start.getMonth() - 3);
    } else if (timeframe === "6M") {
      start.setMonth(start.getMonth() - 6);
    } else if (timeframe === "1Y") {
      start.setFullYear(start.getFullYear() - 1);
    }

    return priceSeries.filter((p) => {
      const d = new Date(p.date);
      return d >= start && d <= end;
    });
  }, [priceSeries, timeframe, minDate]);

  const avgDailyVolume = useMemo<number | null>(() => {
    if (priceSeries.length === 0) return null;
    const lastN = priceSeries.slice(-AVG_DAILY_VOLUME_DAYS);
    const totalVol = lastN.reduce((sum, p) => sum + (p.volume ?? 0), 0);
    const count = lastN.length;
    return count > 0 ? totalVol / count : null;
  }, [priceSeries]);

  const dividendEvents = useMemo<DividendEvent[]>(() => {
    if (!data || !data.success || !Array.isArray(data.dividends)) return [];
    return [...data.dividends].sort((a, b) => {
      const da = a.paymentDate ?? a.exDate ?? a.declarationDate ?? "";
      const db = b.paymentDate ?? b.exDate ?? b.declarationDate ?? "";
      return da.localeCompare(db);
    });
  }, [data]);

  const dividendBuckets = useMemo<AggregatedDividendBucket[]>(() => {
    if (dividendEvents.length === 0) return [];
    if (!effectiveBaseEtf) return [];

    const rocPercent = effectiveBaseEtf.rocPercent ?? 0;

    const byBucket: Record<string, AggregatedDividendBucket> = {};

    for (const d of dividendEvents) {
      const keyDate = d.paymentDate ?? d.exDate ?? d.declarationDate;
      if (!keyDate) continue;
      const date = new Date(keyDate);
      const year = date.getFullYear();
      const month = date.getMonth();

      const isWeekly = effectiveBaseEtf.payoutFrequency === "Weekly";
      let bucketKey: string;
      let label: string;

      if (isWeekly) {
        const bucketStart = new Date(date);
        bucketStart.setDate(bucketStart.getDate() - bucketStart.getDay());
        const iso = bucketStart.toISOString().split("T")[0];
        bucketKey = `W-${iso}`;
        label = formatMMDDYYYY(iso);
      } else {
        bucketKey = `M-${year}-${month + 1}`;
        label = formatMMDDYYYY(`${year}-${String(month + 1).padStart(2, "0")}`);
      }

      if (!byBucket[bucketKey]) {
        byBucket[bucketKey] = {
          label,
          startDate: keyDate,
          totalAmount: 0,
          trueIncomePortion: 0,
          rocPortion: 0,
          cumulativeYield: 0,
        };
      }

      const bucket = byBucket[bucketKey];
      bucket.totalAmount += d.amount;
    }

    const buckets = Object.values(byBucket).sort((a, b) => a.startDate.localeCompare(b.startDate));

    let cumulativeDividends = 0;
    const latestPrice = effectiveBaseEtf.latestAdjClose || null;

    for (const bucket of buckets) {
      const rocPortion = bucket.totalAmount * (rocPercent / 100);
      const truePortion = Math.max(bucket.totalAmount - rocPortion, 0);
      bucket.rocPortion = rocPortion;
      bucket.trueIncomePortion = truePortion;

      cumulativeDividends += bucket.totalAmount;
      if (latestPrice && latestPrice > 0) {
        bucket.cumulativeYield = (cumulativeDividends / latestPrice) * 100;
      } else {
        bucket.cumulativeYield = 0;
      }
    }

    return buckets;
  }, [dividendEvents, effectiveBaseEtf]);

  const dividendAnalytics = useMemo<DividendAnalytics>(() => {
    if (dividendBuckets.length === 0) {
      return {
        monthOverMonthChangePct: null,
        yearOverYearChangePct: null,
      };
    }

    const monthlyBuckets = [...dividendBuckets];

    let monthOverMonthChangePct: number | null = null;
    if (monthlyBuckets.length >= 2) {
      const last = monthlyBuckets[monthlyBuckets.length - 1];
      const prev = monthlyBuckets[monthlyBuckets.length - 2];
      if (prev.totalAmount !== 0) {
        monthOverMonthChangePct = ((last.totalAmount - prev.totalAmount) / prev.totalAmount) * 100;
      }
    }

    let yearOverYearChangePct: number | null = null;
    if (monthlyBuckets.length >= 24) {
      const last12 = monthlyBuckets.slice(-12).reduce((sum, b) => sum + b.totalAmount, 0);
      const prev12 = monthlyBuckets.slice(-24, -12).reduce((sum, b) => sum + b.totalAmount, 0);
      if (prev12 !== 0) {
        yearOverYearChangePct = ((last12 - prev12) / prev12) * 100;
      }
    }

    return {
      monthOverMonthChangePct,
      yearOverYearChangePct,
    };
  }, [dividendBuckets]);

  /** SEC-style 30-day yield: 2 * [ ((a - b) / d) + 1 ]^6 - 1 (per-share; a=divs in 30d, b=expense per share, d=price) */
  const secYield30d = useMemo<number | null>(() => {
    if (!effectiveBaseEtf || priceSeries.length === 0 || dividendEvents.length === 0) return null;
    const lastPoint = priceSeries[priceSeries.length - 1];
    const endDate = new Date(lastPoint.date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - SEC_YIELD_DAYS);
    const d = lastPoint.close ?? effectiveBaseEtf.latestAdjClose;
    if (d == null || d <= 0) return null;

    const a = dividendEvents
      .filter((ev) => {
        const key = ev.exDate ?? ev.paymentDate ?? ev.declarationDate;
        if (!key) return false;
        const t = new Date(key);
        return t >= startDate && t <= endDate;
      })
      .reduce((sum, ev) => sum + ev.amount, 0);

    const expenseRatioPct = effectiveBaseEtf.expenseRatio ?? 0;
    const b = (expenseRatioPct / 100) * d * (SEC_YIELD_DAYS / 365);
    const ratio = (a - b) / d + 1;
    if (ratio <= 0) return null;
    const yieldDecimal = 2 * Math.pow(ratio, 6) - 1;
    return yieldDecimal;
  }, [priceSeries, dividendEvents, effectiveBaseEtf]);

  /** 1-year annualized volatility: std(daily returns) * sqrt(252) */
  const volatility1y = useMemo<number | null>(() => {
    if (priceSeries.length < 2) return null;
    const lastN = priceSeries.slice(-TRADING_DAYS_1Y);
    const closes = lastN.map((p) => p.close).filter((c): c is number => c != null && c > 0);
    if (closes.length < 2) return null;

    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const r = (closes[i] - closes[i - 1]) / closes[i - 1];
      returns.push(r);
    }
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const std = Math.sqrt(variance);
    return std * Math.sqrt(252);
  }, [priceSeries]);

  const holdingsTop10 = useMemo<HoldingItem[]>(() => {
    if (!data || !data.success || !Array.isArray(data.holdings)) return [];
    const sorted = [...data.holdings].sort((a, b) => {
      const aw = a.weight ?? 0;
      const bw = b.weight ?? 0;
      return bw - aw;
    });
    return sorted.slice(0, 10);
  }, [data]);

  const sectors = useMemo<SectorWeight[]>(() => {
    if (!data || !data.success || !Array.isArray(data.sectors)) return [];
    return data.sectors;
  }, [data]);

  return {
    timeframe,
    setTimeframe,
    loading: isLoading,
    error: error
      ? (error instanceof Error ? error.message : String(error))
      : baseEtfError
        ? (baseEtfError instanceof Error ? baseEtfError.message : String(baseEtfError))
        : (data && !data.success && data.error ? data.error : null),
    priceSeries,
    priceSeriesFiltered,
    avgDailyVolume,
    secYield30d,
    volatility1y,
    dividendEvents,
    dividendBuckets,
    dividendAnalytics,
    holdingsTop10,
    sectors,
  };
}

export type { Timeframe, PricePoint, DividendEvent, HoldingItem, SectorWeight, AggregatedDividendBucket, DividendAnalytics };

