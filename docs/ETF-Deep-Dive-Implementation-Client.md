# ETF Deep-Dive Modal — Implementation Summary for Client

This document describes what is implemented in the ETF Deep-Dive feature, where data comes from, and how key values are calculated. It is aligned with your SOW so you can verify logic and formulas.

---

## 1. Opening & Layout

| SOW item | Status | Implementation |
|----------|--------|-----------------|
| Opens on ticker click from any page | ✅ | Modal opens from dashboard, watchlist, and Insights (via `EtfTickerChip` / deep-dive context). |
| Tabbed layout (Summary, Dividends, Performance, Holdings, Expenses, Risk & Tax, News & Filings) | ✅ | All seven tabs exist and are wired. |
| Gating: Free = limited view; Basic/Advanced = full view | ❌ | Not implemented. All users currently see the full modal. |

---

## 2. Data Sources (High Level)

- **Supabase `etfs` table**: Core ETF metrics (price, yields, ROC, canary, AUM, expense ratio, returns, issuer, description, website, beta, etc.). Populated/updated by our **data ingestion pipeline** (`bootstrap_database.py`) which calls **FMP** and applies **YieldCanary (YC) calculations** for ROC, True Income Yield, Canary Status, Death Clock.
- **Supabase Edge Function `etf-deep-dive`**: Fetches from **FMP** on demand: historical prices (EOD), dividends, ETF holdings, sector weightings. Cached in the frontend (e.g. 10 min stale time) for speed.
- **Supabase `notices_19a1`**: YC ROC notices (estimated ROC %, notice date); linked to ETF by `ticker_id`.
- **Supabase Edge Function `etf-news`**: Fetches **FMP** stock news by symbol for the “Recent News” section.

---

## 3. Header Section (Top Banner)

| Field | Source | Notes |
|-------|--------|------|
| Ticker + Full Name | Supabase `etfs` | `ticker`, `name` from DB (name from FMP `etf/info` or profile). |
| Latest Price | Supabase `etfs` | `latest_adj_close`; ingestion uses FMP historical EOD (latest close). |
| Change (%) | **Computed in frontend** | **Formula:** From `priceSeries` (etf-deep-dive): last close vs previous close; `(last − prev) / prev × 100`. Displayed with +/− and green/red; “—” when insufficient data. |
| “As of” date | Supabase `etfs` | `latest_date` from ingestion. |
| Headline Yield (TTM) | Supabase `etfs` | `headline_yield_ttm`. **Formula (in ingestion):** `(dividends_last_12mo / latest_price) × 100`. Dividends in last 12 months from FMP dividend history. |
| True Income Yield | Supabase `etfs` | `true_income_yield`. **Formula (in ingestion):** `headline_yield_ttm × (1 - roc_percent/100)`. |
| Canary Status | Supabase `etfs` | `canary_health`. **Logic (in ingestion):** ROC ≥ 40% → Dead; ROC ≥ 20% → Dying; else Healthy. |
| Death Clock | Supabase `etfs` | `death_clock_years`. **Formula (in ingestion):** `50 / roc_percent` (years until half of investment is gone at current ROC rate). Displayed as e.g. “0.9 years”. |
| ROC % | Supabase `etfs` | `roc_latest`. **Derivation:** YC estimate from NAV erosion (see **ROC %** section below). |
| Payout Frequency | Supabase `etfs` | `payout_frequency` (Weekly/Monthly/Quarterly); from FMP where available. |
| AUM | Supabase `etfs` | `aum` from FMP `etf/info` (assetsUnderManagement) or profile. |
| Expense Ratio | Supabase `etfs` | `expense_ratio` from FMP `etf/info` (stored as percentage, e.g. 0.99). |
| Add to Watchlist | ✅ | Uses `useWatchlist`; adds/removes ticker from user watchlist. |
| Compare to Similar | ✅ | Button present; currently closes the modal (filtered dashboard link to be wired later). |

---

## 4. ROC % (Return of Capital) — How It’s Derived

ROC is **not** from FMP; it is a **YieldCanary estimate** in the ingestion pipeline.

- **Inputs:** Price at inception (or earliest available), latest price, total dividends since inception, years since inception (min 3 months).
- **Logic (simplified):**
  - If **price declined**: NAV erosion = |price change|. Annualize erosion and dividends; ROC % = (annual erosion / annual dividends) × 100, capped at 100%.
  - If **price increased** but **dividends > price gain** (underfunded): Shortfall = annual dividends − annual price gain; ROC % = (shortfall / annual dividends) × 100, capped at 100%.
  - Otherwise (e.g. no dividends, or fully funded by gains): ROC = 0%.
- Result is stored as `roc_latest` (percentage) and used for Canary Status, Death Clock, True Income Yield, and all ROC-related UI.

---

## 5. Interactive Charts Section

### 5.1 Price Graph

| SOW item | Status | Implementation |
|----------|--------|-----------------|
| Line chart, 1Y+ | ✅ | Uses `priceSeries` from `etf-deep-dive` (FMP historical EOD); full history loaded, then filtered by timeframe. |
| Timeframe slider (1M/3M/6M/1Y/All) | ✅ | `timeframe` state filters `priceSeries` by date range. |
| Price + volume bars | ✅ | Line = close price; bars = volume (right y-axis). |
| Dividend ex-dates as markers | ✅ | Dates of dividend events (ex-date or payment date) are matched to price dates; scatter points overlay on the line. |
| Zoom/pan | ✅ | ECharts `dataZoom` (inside + slider); same for all deep-dive charts. |

**Data:** Prices and volume from FMP `historical-price-eod/full`. Dividends from FMP `dividends` (same as in edge function). Filtering by 1M/3M/6M/1Y is calendar-based from the latest date in the series.

### 5.2 Dividend History Bar Chart

| SOW item | Status | Implementation |
|----------|--------|-----------------|
| Bars for per-share distributions over time | ✅ | Dividends aggregated into buckets (weekly or monthly from `payout_frequency`). |
| Stack: ROC vs True Income (red/green) | ✅ | Each bucket: `rocPortion = totalAmount × (roc_percent/100)`, `trueIncomePortion = totalAmount − rocPortion`. Stacked bars + cumulative yield line. |
| Cumulative yield line | ✅ | For each bucket: cumulative dividends to date / latest price × 100 (%). |
| % change MoM / YoY | ✅ | **MoM:** (last bucket total − previous bucket total) / previous bucket total × 100. **YoY:** (last 12 buckets total − prior 12 buckets total) / prior 12 × 100. Displayed in Dividends tab; decreases can be highlighted. |
| After-tax estimates (user tax rate) | ✅ | Dividends tab: “After-Tax Take-Home Yield” = after-tax dividends last 12 months / latest price × 100. Risk & Tax tab: after-tax dividends and take-home return formulas (see below). |
| Table: date, amount, ROC % | ✅ | Dividend events table: declaration, ex-date, record, payment, cash amount. ROC % is the fund-level `rocPercent` (same for all rows; no per-distribution ROC). |
| Qualified % | ❌ | Not available from current data; column not shown. |
| Nasdaq dividend history | ❌ | Not integrated; we use FMP dividend history only. |

**Bucket logic:** If payout frequency is Weekly, buckets are week-start dates; otherwise calendar months. Each FMP dividend is assigned to one bucket; amounts are summed, then split into ROC vs True Income using the fund’s `rocPercent`.

---

## 6. Facts & Figures (Key Metrics Grid) — Summary Tab

| Metric | Source | Formula / Notes |
|--------|--------|------------------|
| Inception Date | Supabase `etfs` | `inception_date` from FMP `etf/info` or profile. |
| Issuer | Supabase `etfs` | `issuer` from FMP `etf/info` (etfCompany). |
| Underlying Asset | ❌ | Not implemented; no structured field in DB or FMP used for “e.g. MSTR options”. |
| AUM | Supabase `etfs` | From FMP; displayed with B/M/K formatting. |
| Expense Ratio | Supabase `etfs` | From FMP; displayed as percentage. |
| Avg Daily Volume (30d) | **Computed in frontend** | **Formula:** Mean of `volume` over the last 30 trading days in `priceSeries` (from `etf-deep-dive`). |
| 30-Day SEC Yield | **Computed in frontend** | **Formula (SEC-style 30-day):** Use dividends in the last 30 calendar days (from `dividendEvents`) and latest price. `a` = sum of dividends in 30d, `b` = (expense_ratio/100) × price × (30/365) (expense per share over 30d), `d` = price. Then `yield = 2 × [ ((a − b)/d + 1)^6 ] − 1` (annualized). Returned as decimal (e.g. 0.085 = 8.5%); displayed as %. |
| Volatility (1Y) | **Computed in frontend** | **Formula:** Last 252 trading days of closes; daily returns = (close[i] − close[i−1]) / close[i−1]; annualized volatility = std(daily returns) × √252. Displayed as %. |
| Beta | Supabase `etfs` | `beta` from FMP profile. |
| Total Return (1Y / YTD / Inception) | Supabase `etfs` | `total_return_1y`, `total_return_ytd`, `total_return_since_inception`. **Ingestion formulas:** 1Y: (latest_price/price_1y_ago − 1)×100; YTD: (latest_price/price_ytd_start − 1)×100; Inception: (latest_price/price_at_inception − 1)×100. |

**YC Insights box:** Implemented. Uses Canary Status, ROC %, True Income Yield, and user tax rate to show short interpretive text and points user to after-tax estimates in other tabs.

---

## 7. Fund Description & More Info — Summary Tab

| Item | Status | Implementation |
|------|--------|-----------------|
| Description (strategy/objectives/risks) | ✅ | `description` from Supabase (FMP `etf/info`). Fallback: “No description available.” |
| Link to issuer/fund website | ✅ | `website` from Supabase (FMP `etf/info`). “Visit fund website” link. |
| Risk Warnings (YC) | ✅ | Reflected in YC Insights and in Risk & Tax tab (risk copy based on ROC/Canary). |
| Add to Watchlist | ✅ | In header. |

---

## 8. Performance Tab

| Item | Source / Formula |
|------|-------------------|
| Growth of $10,000 | **Frontend:** From `priceSeries`. First close = P0. For each date, value = 10,000 × (close / P0). Price-only (no reinvested dividends). Bar chart; zoom/pan via ECharts. |
| Period returns 1M / 3M / 6M | **Frontend:** From `priceSeries`. For 1M/3M/6M: find close at N months before last date; return = (last_close − that_close) / that_close × 100. |
| 1Y / YTD / Inception | **Supabase `etfs`:** `total_return_1y`, `total_return_ytd`, `total_return_since_inception` (see ingestion formulas in section 6). |

---

## 9. Holdings Tab

| Item | Source |
|------|--------|
| Top 10 holdings table | `etf-deep-dive` → FMP `etf/holdings`. Sorted by weight, top 10. Columns: ticker/symbol, name, weight %, sector. |
| Holdings allocation pie | Same holdings; pie by weight; chart colors from theme. |
| Sector Allocation bar chart | `etf-deep-dive` → FMP `etf/sector-weightings`. Sector name and weight %; bar chart with zoom/pan. |

---

## 10. Expenses Tab

| Item | Source / Formula |
|------|-------------------|
| Expense ratio | Supabase `etfs` → `expense_ratio` (from FMP). |
| Approximate cost on $10k | (expense_ratio / 100) × 10,000. |
| Comparison to SPY | Fixed SPY expense ratio (0.09%); multiple shown (e.g. “X times SPY”). |
| Comparison to median | Median of all `expense_ratio` values in `etfs` (Supabase query); 24h stale, 7d cache. |

---

## 11. Risk & Tax Tab

| Item | Source / Formula |
|------|-------------------|
| Canary Status, Death Clock, ROC %, True Income Yield, Volatility (1Y), Beta | Same as Summary: DB for canary/death/ROC/true income/beta; frontend for volatility (see section 6). |
| After-tax dividends (last 12 months) | `dividends_last_12mo` (from DB) × (1 − tax_rate/100). |
| After-tax yield (1Y) | After-tax dividends last 12mo / latest_adj_close × 100. |
| Take-home return (1Y) | **Formula:** `((latest_adj_close × (1 − tax/100) + dividends_last_12mo × (1 − tax/100)) / price_1y_ago) − 1`, then × 100. Both price gain and dividends taxed at same rate for simplicity. |
| Take-home cash return (1Y) | **Formula:** `(latest_adj_close − price_1y_ago + dividends_last_12mo × (1 − tax/100)) / price_1y_ago × 100`. Price change plus after-tax dividends, as % of starting price. |

User tax rate comes from profile/settings (`useUserTaxRate`). If no tax rate, after-tax metrics show a message to set it.

---

## 12. News & Filings Tab

| Item | Source |
|------|--------|
| Filings & Disclosures (19a-1 style) | Supabase `notices_19a1`: latest row for this ETF (`ticker_id`). Shows notice date, effective date, YC-estimated ROC % (from `roc_percent`). Clearly labeled as YC estimate, not official issuer filing. |
| Recent News | Edge function `etf-news` → FMP `news/stock?symbols={ticker}`. Title, date, publisher/site, link. Cached in frontend (e.g. 30 min stale). |

---

## 13. Caching & Performance

- **etf-deep-dive:** TanStack Query key `["etf-deep-dive", ticker]`; stale time 10 minutes.
- **etf-news:** Stale/cache tuned (e.g. 30 min stale, 2h cache); refetch on window focus off.
- **Expense stats (median):** 24h stale, 7d cache.
- Modal is responsive; outer and inner scroll areas use custom scrollbar; on mobile the whole modal scrolls so the tab content area is usable.

---

## 14. Not Implemented / Out of Scope (Current)

- **Gating:** Free vs Basic/Advanced and blurred sections are not implemented.
- **Underlying Asset:** No structured field; not shown.
- **Qualified %** in dividend table: Not in data source; not shown.
- **Nasdaq dividend history:** Only FMP dividends are used.
- **Compare to Similar:** Button closes modal; filtered dashboard link not wired.
- **Export/Share:** No chart PNG download or shareable modal link yet.
- **Daily price change %:** Header shows placeholder; would need prior close or real-time source.

---

## 15. Formula Quick Reference

| Metric | Formula |
|--------|---------|
| Headline yield (TTM) | (Dividends last 12 months / Latest price) × 100 |
| True Income Yield | Headline yield × (1 − ROC%/100) |
| ROC % (YC) | From NAV erosion / underfunded distributions (see section 4). |
| Death Clock (years) | 50 / ROC% |
| Canary | Dead if ROC ≥ 40%; Dying if ROC ≥ 20%; else Healthy. |
| SEC 30-day yield (frontend) | 2 × [ ((a−b)/d + 1)^6 ] − 1, with a = divs in 30d, b = expense per share over 30d, d = price. |
| 1Y Volatility | Std(daily returns over last 252 days) × √252 |
| Avg Daily Volume (30d) | Mean(volume) over last 30 days in price series |
| Total return 1Y | (Latest price / Price 1Y ago − 1) × 100 |
| Take-home return 1Y | ((Latest×(1−t) + Divs12×(1−t)) / Price1Y) − 1, then ×100 |
| Take-home cash return 1Y | (Latest − Price1Y + Divs12×(1−t)) / Price1Y × 100 |
| Dividend bucket ROC portion | Bucket total × (ROC%/100); True Income = total − ROC portion |
| Cumulative yield (per bucket) | Cumulative dividends to date / Latest price × 100 |
| Growth of $10k | 10,000 × (Close / First close) for each date |
| Daily price change % | (Last close − Previous close) / Previous close × 100 (from priceSeries) |

If you want any formula written out in exact code or with sample numbers, we can add a separate appendix.
