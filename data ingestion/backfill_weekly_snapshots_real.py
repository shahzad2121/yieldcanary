"""
One-off script to populate etf_weekly_snapshots with real last-week and this-week data.

Purpose
-------
- The weekly-movers Edge Function needs two weeks of data with DIFFERENT values
  to show meaningful ROC / Death Clock / True Income deltas.
- This script computes last week's metrics from weekly_data (prices + dividends)
  using the same formulas as bootstrap, and uses current etfs for this week.
- ETFs without weekly_data: falls back to FMP API (if FMP_API_KEY is set) to get
  more movers. This is a one-off fix when weekly_data is incomplete.
- After running once, the normal snapshot_weekly_etf_metrics.py workflow takes over;
  from next week onward everything works as usual.

Usage
-----
Run once from project root:

    python "data ingestion/backfill_weekly_snapshots_real.py"

Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
Optional: FMP_API_KEY (for fallback when weekly_data is missing for an ETF)
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests
from dotenv import load_dotenv
from supabase import create_client, Client


# ---- Copy of helper functions from bootstrap_database.py (keeps script self-contained) ----

def _calculate_nav_trend_factor(total_return_1y: Optional[float]) -> float:
    """NAV Trend Factor: 0.5 if 1Y return >= 0, else 1.0 (conservative default)."""
    if total_return_1y is None:
        return 1.0
    return 0.5 if total_return_1y >= 0 else 1.0


def _calculate_effective_roc(
    roc_percent: Optional[float],
    nav_trend_factor: float,
    floor_pct: float = 5.0,
    cap_pct: float = 100.0,
) -> Optional[float]:
    """Effective ROC = ROC * NAV_Trend_Factor, floored at 5%, capped at 100%.
    Returns None for zero/negative ROC (no erosion — no Death Clock needed)."""
    if roc_percent is None or roc_percent <= 0:
        return None
    raw = roc_percent * nav_trend_factor
    return round(max(floor_pct, min(cap_pct, raw)), 2)


def _determine_canary_health(
    effective_roc: Optional[float],
    total_return_1y: Optional[float] = None,
) -> str:
    """
    4-tier canary status using Effective ROC thresholds.

    Tiers:
      Healthy     < 25%
      Watch       25–49.99%
      High Risk   50–74.99%
      Severe Risk >= 75%

    Hard override: Severe Risk when 1Y return < -15% (regardless of ROC).
    Backfill note: total_return_1y is computed from historical price data so
    the override applies correctly even for historical snapshots.
    """
    if total_return_1y is not None and total_return_1y < -15.0:
        return "Severe Risk"
    if effective_roc is None:
        return "Unknown"
    if effective_roc >= 75:
        return "Severe Risk"
    if effective_roc >= 50:
        return "High Risk"
    if effective_roc >= 25:
        return "Watch"
    return "Healthy"


def _calculate_death_clock(
    effective_roc: Optional[float],
    total_return_1y: Optional[float] = None,
) -> Optional[float]:
    """
    Death Clock = 50 / Effective_ROC with a 2.0-year floor when 1Y return >= 0.

    Backfill note: pass total_return_1y from historical price data so the
    floor is applied consistently with the live pipeline.
    """
    if effective_roc is None or effective_roc <= 0:
        return None
    raw = round(50 / effective_roc, 2)
    if total_return_1y is not None and total_return_1y >= 0:
        raw = max(raw, 2.0)
    return raw


def _clamp_numeric(
    value: Optional[float],
    max_val: float = 9999.9999,
    min_val: float = -9999.9999,
) -> Optional[float]:
    if value is None:
        return None
    return max(min_val, min(max_val, value))


def _estimate_roc_from_nav_erosion(
    price_at_inception: Optional[float],
    latest_price: Optional[float],
    total_dividends: float,
    years_since_inception: float,
    min_months: int = 3,
) -> Optional[float]:
    if not price_at_inception or not latest_price:
        return None
    if years_since_inception < (min_months / 12):
        return 0.0
    if total_dividends <= 0:
        return 0.0

    price_change = latest_price - price_at_inception

    if price_change < 0:
        nav_erosion = abs(price_change)
        annual_nav_erosion = nav_erosion / years_since_inception
        annual_dividends = total_dividends / years_since_inception
        if annual_dividends > 0:
            roc_estimate = min((annual_nav_erosion / annual_dividends) * 100, 100)
            return round(roc_estimate, 2)
    else:
        annual_price_gain = price_change / years_since_inception
        annual_dividends = total_dividends / years_since_inception
        if annual_dividends > annual_price_gain:
            shortfall = annual_dividends - annual_price_gain
            roc_estimate = min((shortfall / annual_dividends) * 100, 100)
            return round(roc_estimate, 2)

    return 0.0


# ---- FMP fallback (one-off fix when weekly_data is incomplete) ----

FMP_BASE_URL = "https://financialmodelingprep.com/stable"
FMP_REQUESTS_PER_MINUTE = 250
FMP_MIN_INTERVAL = 60.0 / FMP_REQUESTS_PER_MINUTE


class _FMPClient:
    """Minimal FMP client for backfill fallback."""

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self._last_request = 0.0

    def _wait(self) -> None:
        elapsed = time.time() - self._last_request
        if elapsed < FMP_MIN_INTERVAL:
            time.sleep(FMP_MIN_INTERVAL - elapsed)
        self._last_request = time.time()

    def _request(self, endpoint: str, params: dict | None = None) -> list | dict:
        if params is None:
            params = {}
        params["apikey"] = self.api_key
        self._wait()
        resp = requests.get(f"{FMP_BASE_URL}/{endpoint}", params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and data.get("Error Message"):
            raise RuntimeError(data["Error Message"])
        return data

    def get_etf_info(self, ticker: str) -> dict | None:
        try:
            data = self._request("etf/info", {"symbol": ticker})
            return data[0] if data and len(data) > 0 else None
        except Exception:
            return None

    def get_historical_prices(
        self,
        ticker: str,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> list:
        try:
            params: dict = {"symbol": ticker}
            if from_date:
                params["from"] = from_date
            if to_date:
                params["to"] = to_date
            data = self._request("historical-price-eod/full", params)
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def get_dividends(self, ticker: str) -> list:
        try:
            data = self._request("dividends", {"symbol": ticker})
            return data if isinstance(data, list) else []
        except Exception:
            return []


def _find_price_on_date(
    prices: list, target_date: datetime, lookback_days: int = 14
) -> float | None:
    target_str = target_date.strftime("%Y-%m-%d")
    min_date = (target_date - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    for row in prices:
        date_str = row.get("date", "")
        if min_date <= date_str <= target_str:
            return row.get("close")
    return None


def _find_earliest_price(prices: list) -> tuple[float | None, str | None]:
    if not prices:
        return None, None
    earliest = prices[-1]
    return earliest.get("close"), earliest.get("date")


def _calc_dividends_in_range(
    dividends: list, start_date: datetime, end_date: datetime
) -> float:
    total = 0.0
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    for div in dividends:
        date_str = div.get("date", "")
        if start_str <= date_str <= end_str:
            total += div.get("adjDividend", 0) or div.get("dividend", 0) or 0
    return total


def _compute_last_week_from_fmp(
    ticker_id: str,
    ticker: str,
    last_week_end: datetime,
    last_week_str: str,
    fmp: _FMPClient,
    five_years_ago_str: str,
) -> dict | None:
    """Compute last-week metrics from FMP. Returns snapshot dict or None."""
    etf_info = fmp.get_etf_info(ticker)
    if not etf_info or not etf_info.get("inceptionDate"):
        return None

    inception_str = etf_info["inceptionDate"][:10]
    try:
        inception_dt = datetime.strptime(inception_str, "%Y-%m-%d")
    except ValueError:
        return None

    prices = fmp.get_historical_prices(
        ticker,
        from_date=five_years_ago_str,
        to_date=last_week_end.strftime("%Y-%m-%d"),
    )
    if not prices:
        return None

    latest_price = _find_price_on_date(prices, last_week_end, lookback_days=14)
    if not latest_price:
        return None

    price_at_inception = _find_price_on_date(prices, inception_dt, lookback_days=14)
    if not price_at_inception:
        ep, _ = _find_earliest_price(prices)
        if ep:
            price_at_inception = ep
    if not price_at_inception:
        return None

    years_since = (last_week_end - inception_dt).days / 365.0
    if years_since < 0:
        return None

    dividends = fmp.get_dividends(ticker)
    dividends_since_inception = _calc_dividends_in_range(dividends, inception_dt, last_week_end)
    one_year_before = last_week_end - timedelta(days=365)
    dividends_last_12mo = _calc_dividends_in_range(dividends, one_year_before, last_week_end)

    roc = _estimate_roc_from_nav_erosion(
        price_at_inception,
        latest_price,
        dividends_since_inception,
        years_since,
    )
    if roc is None:
        return None

    # Compute 1Y price return from already-fetched historical prices.
    # Used for NAV Trend Factor, Death Clock floor, and Severe Risk override.
    price_1y_ago = _find_price_on_date(prices, one_year_before, lookback_days=14)
    total_return_1y: float | None = None
    if price_1y_ago and price_1y_ago > 0:
        total_return_1y = round(((latest_price / price_1y_ago) - 1) * 100, 2)

    nav_trend_factor = _calculate_nav_trend_factor(total_return_1y)
    effective_roc = _calculate_effective_roc(roc, nav_trend_factor)

    death_clock = _calculate_death_clock(effective_roc, total_return_1y)
    # 0% ROC (no erosion) → effective_roc is None → classify as Healthy directly
    if effective_roc is None and roc is not None and roc <= 0:
        canary_health = "Healthy"
    else:
        canary_health = _determine_canary_health(effective_roc, total_return_1y)
    headline_yield = (dividends_last_12mo / latest_price) * 100 if latest_price > 0 else None
    true_income = (
        round(headline_yield * (1 - roc / 100), 6)
        if headline_yield is not None
        else None
    )
    headline_yield = _clamp_numeric(headline_yield) if headline_yield is not None else None

    return {
        "ticker_id": ticker_id,
        "week_start_date": last_week_str,
        "roc_percent": roc,
        "death_clock_years": death_clock,
        "true_income_yield": true_income,
        "headline_yield_ttm": headline_yield,
        "canary_health": canary_health,
    }


# ---- Env and week dates ----

def _validate_env() -> tuple[str, str]:
    load_dotenv(".env.local")
    supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    missing = []
    if not supabase_url:
        missing.append("SUPABASE_URL or VITE_SUPABASE_URL")
    if not supabase_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}"
        )
    return supabase_url, supabase_key


def _get_week_start_utc(dt: datetime) -> datetime:
    base = datetime(
        year=dt.year,
        month=dt.month,
        day=dt.day,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    return base - timedelta(days=base.weekday())


# ---- Main backfill ----

def backfill_weekly_snapshots_real() -> None:
    supabase_url, supabase_key = _validate_env()
    supabase: Client = create_client(supabase_url, supabase_key)

    now_utc = datetime.now(timezone.utc)
    this_week_monday = _get_week_start_utc(now_utc)
    last_week_monday = this_week_monday - timedelta(days=7)
    last_week_end = last_week_monday + timedelta(days=6)  # Sunday

    this_week_str = this_week_monday.date().isoformat()
    last_week_str = last_week_monday.date().isoformat()
    last_week_end_str = last_week_end.date().isoformat()

    print("=" * 60)
    print("Backfill Weekly Snapshots (Real Data)")
    print("=" * 60)
    print(f"  Last week:  {last_week_str} (Mon) — {last_week_end_str} (Sun)")
    print(f"  This week:  {this_week_str} (Mon)")

    # 1. Fetch ETFs
    print("\nFetching ETFs...")
    etfs_resp = supabase.table("etfs").select(
        "id, ticker, inception_date, price_at_inception, "
        "roc_latest, death_clock_years, true_income_yield, "
        "headline_yield_ttm, canary_health"
    ).execute()
    etfs = etfs_resp.data or []
    if not etfs:
        print("  ⚠ No ETFs found.")
        return
    print(f"  ✓ {len(etfs)} ETFs")

    # 2. Fetch weekly_data up to last_week_end
    print("\nFetching weekly_data (date <= last week end)...")
    wd_resp = (
        supabase.table("weekly_data")
        .select("ticker_id, date, adj_close, dividend")
        .lte("date", last_week_end_str)
        .order("date", desc=False)
        .execute()
    )
    wd_rows = wd_resp.data or []

    # Group by ticker_id
    by_ticker: dict[str, list[dict]] = {}
    for row in wd_rows:
        tid = row["ticker_id"]
        if tid not in by_ticker:
            by_ticker[tid] = []
        by_ticker[tid].append(row)

    print(f"  ✓ {len(wd_rows)} rows for {len(by_ticker)} tickers")

    # 3. Compute last week metrics for each ETF (weekly_data first, FMP fallback when missing)
    last_week_snapshots: list[dict] = []
    one_year_before_end = last_week_end - timedelta(days=365)
    one_year_before_str = one_year_before_end.date().isoformat()
    five_years_ago_str = (last_week_end - timedelta(days=1825)).strftime("%Y-%m-%d")

    fmp_api_key = os.getenv("FMP_API_KEY")
    fmp = _FMPClient(fmp_api_key) if fmp_api_key else None
    fmp_fallback_count = 0

    for etf in etfs:
        ticker_id = etf["id"]
        ticker = etf.get("ticker", "?")

        rows = by_ticker.get(ticker_id, [])
        if not rows:
            # No weekly_data: try FMP fallback (one-off fix for incomplete weekly_data)
            if fmp:
                try:
                    snap = _compute_last_week_from_fmp(
                        ticker_id, ticker, last_week_end, last_week_str, fmp, five_years_ago_str
                    )
                    if snap:
                        last_week_snapshots.append(snap)
                        fmp_fallback_count += 1
                except Exception as e:
                    pass  # Skip on FMP error
            continue

        inception_str = etf.get("inception_date")
        price_at_inception = etf.get("price_at_inception")
        if price_at_inception is not None:
            price_at_inception = float(price_at_inception)

        # Latest price on or before last_week_end
        latest_row = rows[-1]
        latest_price = float(latest_row["adj_close"])
        latest_date_str = latest_row["date"]

        if latest_date_str > last_week_end_str:
            continue

        # Use inception_date or earliest weekly_data date
        if inception_str:
            try:
                inception_dt = datetime.strptime(inception_str[:10], "%Y-%m-%d")
            except Exception:
                inception_dt = datetime.strptime(rows[0]["date"][:10], "%Y-%m-%d")
        else:
            inception_dt = datetime.strptime(rows[0]["date"][:10], "%Y-%m-%d")

        # Fallback: price_at_inception from earliest row if missing
        if price_at_inception is None:
            price_at_inception = float(rows[0]["adj_close"])

        years_since_inception = (
            last_week_end.date() - inception_dt.date()
        ).days / 365.0
        if years_since_inception < 0:
            continue

        # Dividends since inception (up to last_week_end)
        inception_date_str = inception_str[:10] if inception_str else None
        dividends_since_inception = sum(
            float(r.get("dividend") or 0)
            for r in rows
            if inception_date_str is None or r["date"] >= inception_date_str
        )

        # Dividends in last 12 months
        dividends_last_12mo = sum(
            float(r.get("dividend") or 0)
            for r in rows
            if one_year_before_str <= r["date"] <= last_week_end_str
        )

        roc = _estimate_roc_from_nav_erosion(
            price_at_inception,
            latest_price,
            dividends_since_inception,
            years_since_inception,
        )
        death_clock = _calculate_death_clock(roc)
        canary_health = _determine_canary_health(roc)

        if latest_price and latest_price > 0:
            headline_yield = round(
                (dividends_last_12mo / latest_price) * 100, 6
            )
            headline_yield = _clamp_numeric(headline_yield)
        else:
            headline_yield = None

        if headline_yield is not None and roc is not None:
            true_income = round(headline_yield * (1 - roc / 100), 6)
            true_income = _clamp_numeric(true_income)
        else:
            true_income = None

        last_week_snapshots.append({
            "ticker_id": ticker_id,
            "week_start_date": last_week_str,
            "roc_percent": roc,
            "death_clock_years": death_clock,
            "true_income_yield": true_income,
            "headline_yield_ttm": headline_yield,
            "canary_health": canary_health,
        })

    # 4. Build this week snapshots from current etfs
    this_week_snapshots = [
        {
            "ticker_id": e["id"],
            "week_start_date": this_week_str,
            "roc_percent": e.get("roc_latest"),
            "death_clock_years": e.get("death_clock_years"),
            "true_income_yield": e.get("true_income_yield"),
            "headline_yield_ttm": e.get("headline_yield_ttm"),
            "canary_health": e.get("canary_health"),
        }
        for e in etfs
    ]

    # 5. Upsert both weeks
    all_snapshots = last_week_snapshots + this_week_snapshots

    print("\nUpserting into etf_weekly_snapshots...")
    batch_size = 500
    total = 0
    for i in range(0, len(all_snapshots), batch_size):
        batch = all_snapshots[i : i + batch_size]
        result = supabase.table("etf_weekly_snapshots").upsert(
            batch,
            on_conflict="ticker_id,week_start_date",
        ).execute()
        if getattr(result, "error", None):
            raise RuntimeError(f"Upsert error: {result.error}")
        total += len(batch)
        print(f"  ✓ Batch {i // batch_size + 1}: {len(batch)} rows")

    print("\nBackfill complete.")
    print(f"  Last week:  {len(last_week_snapshots)} ETFs")
    if fmp_fallback_count > 0:
        print(f"    (FMP fallback: {fmp_fallback_count} ETFs without weekly_data)")
    print(f"  This week:  {len(this_week_snapshots)} ETFs")
    print(f"  Total:      {total} rows")
    print("=" * 60)


if __name__ == "__main__":
    try:
        backfill_weekly_snapshots_real()
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception as e:
        print(f"\nFatal error: {e}")
        raise
