/**
 * Shared tax-aware newsletter calculations.
 *
 * Important:
 * - This file contains ONLY pure calculations (no DB calls).
 * - The logic mirrors what the Insights page cards compute client-side
 *   using `users.tax_rate`.
 */
 
export const DEFAULT_TAX_RATE = 20;
 
export type NewsletterEtfTaxRow = {
  ticker: string | null;
  name: string | null;
  canary_health: string | null;
  payout_frequency: string | null;
  last_month_distribution: number | null;
  roc_latest: number | null;
  latest_adj_close: number | null;
  price_1y_ago: number | null;
  dividends_last_12mo: number | null;
  inception_date: string | null;
  price_ytd_start: number | null;
  dividends_ytd: number | null;
};
 
function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
 
function isLessThanOneYear(inceptionDate: string | null): boolean {
  if (!inceptionDate) return false;
  const today = new Date();
  const inception = new Date(inceptionDate);
  const ageInDays =
    (today.getTime() - inception.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays < 365;
}
 
function calcMonthlySpendableCashYield(
  lastMonthDistribution: number | null,
  currentPrice: number | null,
  taxRate: number,
): number | null {
  if (!lastMonthDistribution || !currentPrice || currentPrice <= 0) return null;
  const afterTax = lastMonthDistribution * (1 - taxRate / 100);
  return round4((afterTax / currentPrice) * 100);
}
 
function calcTakeHomeCashReturn1Y(
  latest_adj_close: number | null | undefined,
  price_1y_ago: number | null | undefined,
  dividends_last_12mo: number | null | undefined,
  taxRate: number,
): number | null {
  if (!price_1y_ago || price_1y_ago === 0) return null;
  const afterTaxDiv = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result =
    ((latest_adj_close ?? 0) - (price_1y_ago ?? 0) +
      afterTaxDiv(dividends_last_12mo ?? undefined)) / price_1y_ago;
  return round4(result * 100);
}
 
function calcTakeHomeCashReturnYTD(
  latest_adj_close: number | null | undefined,
  price_ytd_start: number | null | undefined,
  dividends_ytd: number | null | undefined,
  taxRate: number,
): number | null {
  if (!price_ytd_start || price_ytd_start === 0) return null;
  const afterTaxDiv = (x?: number) => (x ?? 0) * (1 - taxRate / 100);
  const result =
    ((latest_adj_close ?? 0) - (price_ytd_start ?? 0) +
      afterTaxDiv(dividends_ytd ?? undefined)) / price_ytd_start;
  return round4(result * 100);
}
 
function getSortValueTakeHome(
  e: NewsletterEtfTaxRow,
  takeHome1Y: number | null,
  takeHomeYTD: number | null,
): number {
  const isNew = isLessThanOneYear(e.inception_date ?? "");
  const hasNo1YData =
    takeHome1Y === null || takeHome1Y === undefined || takeHome1Y === 0;
  if (isNew) return takeHomeYTD ?? -Infinity;
  if (hasNo1YData) return takeHomeYTD ?? -Infinity;
  return takeHome1Y ?? -Infinity;
}
 
function formatTakeHomeReturnLabel(
  e: NewsletterEtfTaxRow,
  takeHome1Y: number | null,
  takeHomeYTD: number | null,
): string {
  const isNew = isLessThanOneYear(e.inception_date ?? "");
  const hasNo1YData =
    takeHome1Y === null || takeHome1Y === undefined || takeHome1Y === 0;
  if (isNew) {
    if (takeHomeYTD === null || takeHomeYTD === undefined) return "0.00% (YTD)";
    return `${takeHomeYTD.toFixed(2)}% (YTD)`;
  }
  if (hasNo1YData) {
    if (takeHomeYTD === null || takeHomeYTD === undefined) return "0.00%";
    return `${takeHomeYTD.toFixed(2)}% (YTD)`;
  }
  return `${(takeHome1Y ?? 0).toFixed(2)}%`;
}
 
export function clampTaxRate(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_TAX_RATE;
  return Math.min(100, Math.max(0, raw));
}
 
export function buildBestAfterTax(rows: NewsletterEtfTaxRow[], taxRate: number) {
  const enriched = rows.map((e) => {
    const takeHomeCashReturn1Y = calcTakeHomeCashReturn1Y(
      e.latest_adj_close,
      e.price_1y_ago,
      e.dividends_last_12mo,
      taxRate,
    );
    const takeHomeCashReturnYTD = calcTakeHomeCashReturnYTD(
      e.latest_adj_close,
      e.price_ytd_start,
      e.dividends_ytd,
      taxRate,
    );
    return { e, takeHomeCashReturn1Y, takeHomeCashReturnYTD };
  });
  const filtered = enriched.filter((x) => x.e.canary_health === "Healthy");
  const sorted = [...filtered].sort((a, b) => {
    const aVal = getSortValueTakeHome(a.e, a.takeHomeCashReturn1Y, a.takeHomeCashReturnYTD);
    const bVal = getSortValueTakeHome(b.e, b.takeHomeCashReturn1Y, b.takeHomeCashReturnYTD);
    if (bVal !== aVal) return bVal - aVal;
    return (a.e.ticker ?? "").localeCompare(b.e.ticker ?? "");
  });
  return sorted.slice(0, 5).map(({ e, takeHomeCashReturn1Y, takeHomeCashReturnYTD }) => ({
    ticker: e.ticker ?? "",
    name: e.name ?? "",
    canaryStatus: e.canary_health ?? "",
    takeHomeCashReturnDisplay: formatTakeHomeReturnLabel(
      e,
      takeHomeCashReturn1Y,
      takeHomeCashReturnYTD,
    ),
  }));
}
 
export function buildTopWeeklyPayers(rows: NewsletterEtfTaxRow[], taxRate: number) {
  const enriched = rows.map((e) => ({
    ...e,
    monthlySpendableCashYield: calcMonthlySpendableCashYield(
      e.last_month_distribution,
      e.latest_adj_close,
      taxRate,
    ),
  }));
  const filtered = enriched.filter(
    (e) => e.canary_health === "Healthy" && e.payout_frequency === "Weekly",
  );
  const sorted = [...filtered].sort((a, b) => {
    const av = a.monthlySpendableCashYield ?? -Infinity;
    const bv = b.monthlySpendableCashYield ?? -Infinity;
    if (bv !== av) return bv - av;
    return (a.ticker ?? "").localeCompare(b.ticker ?? "");
  });
  return sorted.slice(0, 5).map((e) => ({
    ticker: e.ticker ?? "",
    name: e.name ?? "",
    trueIncomeYield: null,
    rocPercent: e.roc_latest,
    monthlySpendableCashYield: e.monthlySpendableCashYield ?? null,
  }));
}
 
export function buildTopMonthlyPayers(rows: NewsletterEtfTaxRow[], taxRate: number) {
  const enriched = rows.map((e) => ({
    ...e,
    monthlySpendableCashYield: calcMonthlySpendableCashYield(
      e.last_month_distribution,
      e.latest_adj_close,
      taxRate,
    ),
  }));
  const filtered = enriched.filter(
    (e) => e.canary_health === "Healthy" && e.payout_frequency === "Monthly",
  );
  const sorted = [...filtered].sort((a, b) => {
    const av = a.monthlySpendableCashYield ?? -Infinity;
    const bv = b.monthlySpendableCashYield ?? -Infinity;
    if (bv !== av) return bv - av;
    return (a.ticker ?? "").localeCompare(b.ticker ?? "");
  });
  return sorted.slice(0, 5).map((e) => ({
    ticker: e.ticker ?? "",
    name: e.name ?? "",
    trueIncomeYield: null,
    rocPercent: e.roc_latest,
    monthlySpendableCashYield: e.monthlySpendableCashYield ?? null,
  }));
}

