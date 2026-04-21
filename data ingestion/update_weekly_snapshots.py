"""
update_weekly_snapshots.py
--------------------------
Single weekly job that keeps etf_weekly_snapshots up to date.

What it does
~~~~~~~~~~~~
1. Computes last week's metrics from weekly_data (prices + dividends stored in
   Supabase).  For any ETF whose weekly_data is missing it falls back to FMP.
2. Copies this week's live metrics straight from the etfs table.
3. Upserts both weeks into etf_weekly_snapshots in one pass.

What it does NOT do
~~~~~~~~~~~~~~~~~~~
- Does NOT touch etf_monthly_roc.  Monthly ROC is owned exclusively by
  snapshot_monthly_roc.py (monthly cron on the 1st) and
  seed_monthly_roc_history.py (one-time seed script).

Run
~~~
    python "data ingestion/update_weekly_snapshots.py"

Env vars required:
    SUPABASE_URL  (or VITE_SUPABASE_URL)
    SUPABASE_SERVICE_ROLE_KEY
    FMP_API_KEY   (optional – enables fallback for ETFs without weekly_data)
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests
from dotenv import load_dotenv
from supabase import create_client, Client


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

def _get_week_start_utc(dt: datetime) -> datetime:
    """ISO-week Monday at UTC midnight."""
    base = datetime(dt.year, dt.month, dt.day, 0, 0, 0, 0)
    return base - timedelta(days=base.weekday())


# ---------------------------------------------------------------------------
# Metric helpers  (same formulas as bootstrap_database.py)
# ---------------------------------------------------------------------------

def _calculate_nav_trend_factor(total_return_1y: Optional[float]) -> float:
    """0.5 if 1Y price return >= 0 (stable / growing NAV), else 1.0."""
    if total_return_1y is None:
        return 1.0
    return 0.5 if total_return_1y >= 0 else 1.0


def _calculate_effective_roc(
    roc_percent: Optional[float],
    nav_trend_factor: float,
    floor_pct: float = 5.0,
    cap_pct: float = 100.0,
) -> Optional[float]:
    """Effective_ROC = ROC * NAV_Trend_Factor, floored at 5%, capped at 100%.
    Returns None for zero/negative ROC (no erosion detected)."""
    if roc_percent is None or roc_percent <= 0:
        return None
    raw = roc_percent * nav_trend_factor
    return round(max(floor_pct, min(cap_pct, raw)), 2)


def _determine_canary_health(
    effective_roc: Optional[float],
    total_return_1y: Optional[float] = None,
) -> str:
    """4-tier Canary Status:
        Healthy     < 25%
        Watch       25–49.99%
        High Risk   50–74.99%
        Severe Risk ≥ 75%  or  1Y return < -15%
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
    """50 / Effective_ROC with a 2.0-year floor when 1Y return >= 0."""
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
            return round(min((annual_nav_erosion / annual_dividends) * 100, 100), 2)
    else:
        annual_price_gain = price_change / years_since_inception
        annual_dividends = total_dividends / years_since_inception
        if annual_dividends > annual_price_gain:
            shortfall = annual_dividends - annual_price_gain
            return round(min((shortfall / annual_dividends) * 100, 100), 2)
    return 0.0


# ---------------------------------------------------------------------------
# FMP fallback client (only used when weekly_data is missing for an ETF)
# ---------------------------------------------------------------------------

FMP_BASE_URL = "https://financialmodelingprep.com/stable"
_FMP_MIN_INTERVAL = 60.0 / 250  # 250 req/min


class _FMPClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self._last = 0.0

    def _wait(self) -> None:
        elapsed = time.time() - self._last
        if elapsed < _FMP_MIN_INTERVAL:
            time.sleep(_FMP_MIN_INTERVAL - elapsed)
        self._last = time.time()

    def _get(self, endpoint: str, params: dict | None = None) -> list | dict:
        p = dict(params or {})
        p["apikey"] = self.api_key
        self._wait()
        r = requests.get(f"{FMP_BASE_URL}/{endpoint}", params=p, timeout=30)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and data.get("Error Message"):
            raise RuntimeError(data["Error Message"])
        return data

    def etf_info(self, ticker: str) -> dict | None:
        try:
            d = self._get("etf/info", {"symbol": ticker})
            return d[0] if d else None
        except Exception:
            return None

    def historical_prices(self, ticker: str, from_date: str, to_date: str) -> list:
        try:
            d = self._get("historical-price-eod/full",
                          {"symbol": ticker, "from": from_date, "to": to_date})
            return d if isinstance(d, list) else []
        except Exception:
            return []

    def dividends(self, ticker: str) -> list:
        try:
            d = self._get("dividends", {"symbol": ticker})
            return d if isinstance(d, list) else []
        except Exception:
            return []


def _find_price_on_date(prices: list, target: datetime, lookback: int = 14) -> float | None:
    t = target.strftime("%Y-%m-%d")
    lo = (target - timedelta(days=lookback)).strftime("%Y-%m-%d")
    for row in prices:
        ds = row.get("date", "")
        if lo <= ds <= t:
            return row.get("close")
    return None


def _dividends_in_range(divs: list, start: datetime, end: datetime) -> float:
    s, e = start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
    return sum(
        d.get("adjDividend", 0) or d.get("dividend", 0) or 0
        for d in divs
        if s <= d.get("date", "") <= e
    )


def _last_week_snapshot_from_fmp(
    ticker_id: str,
    ticker: str,
    last_week_end: datetime,
    last_week_str: str,
    fmp: _FMPClient,
    five_years_ago_str: str,
) -> dict | None:
    """Build a last-week snapshot using FMP when weekly_data is absent."""
    info = fmp.etf_info(ticker)
    if not info or not info.get("inceptionDate"):
        return None
    try:
        inception_dt = datetime.strptime(info["inceptionDate"][:10], "%Y-%m-%d")
    except ValueError:
        return None

    prices = fmp.historical_prices(
        ticker, five_years_ago_str, last_week_end.strftime("%Y-%m-%d")
    )
    if not prices:
        return None

    latest_price = _find_price_on_date(prices, last_week_end)
    if not latest_price:
        return None
    price_at_inception = _find_price_on_date(prices, inception_dt)
    if not price_at_inception:
        price_at_inception = prices[-1].get("close") if prices else None
    if not price_at_inception:
        return None

    years_since = (last_week_end - inception_dt).days / 365.0
    if years_since < 0:
        return None

    divs = fmp.dividends(ticker)
    one_year_before = last_week_end - timedelta(days=365)
    total_divs = _dividends_in_range(divs, inception_dt, last_week_end)
    divs_12mo = _dividends_in_range(divs, one_year_before, last_week_end)

    roc = _estimate_roc_from_nav_erosion(
        price_at_inception, latest_price, total_divs, years_since
    )
    if roc is None:
        return None

    price_1y_ago = _find_price_on_date(prices, one_year_before)
    total_return_1y: float | None = None
    if price_1y_ago and price_1y_ago > 0:
        total_return_1y = round(((latest_price / price_1y_ago) - 1) * 100, 2)

    nav_factor = _calculate_nav_trend_factor(total_return_1y)
    eff_roc = _calculate_effective_roc(roc, nav_factor)
    death_clock = _calculate_death_clock(eff_roc, total_return_1y)
    if eff_roc is None and roc is not None and roc <= 0:
        canary = "Healthy"
    else:
        canary = _determine_canary_health(eff_roc, total_return_1y)

    headline = _clamp_numeric((divs_12mo / latest_price) * 100) if latest_price > 0 else None
    true_income = (
        _clamp_numeric(round(headline * (1 - roc / 100), 6))
        if headline is not None
        else None
    )

    return {
        "ticker_id":         ticker_id,
        "week_start_date":   last_week_str,
        "roc_percent":       roc,
        "death_clock_years": death_clock,
        "true_income_yield": true_income,
        "headline_yield_ttm":headline,
        "canary_health":     canary,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def update_weekly_snapshots() -> None:
    """
    Build and upsert weekly snapshots for:
      - Last week  (computed from weekly_data, FMP fallback for gaps)
      - This week  (copied directly from current etfs table values)
    """
    supabase_url, supabase_key = _validate_env()
    supabase: Client = create_client(supabase_url, supabase_key)

    now_utc = datetime.now(timezone.utc)
    this_monday = _get_week_start_utc(now_utc)
    last_monday = this_monday - timedelta(days=7)
    last_sunday = last_monday + timedelta(days=6)

    this_week_str = this_monday.date().isoformat()
    last_week_str = last_monday.date().isoformat()
    last_week_end_str = last_sunday.date().isoformat()

    print("=" * 60)
    print("Update Weekly Snapshots → etf_weekly_snapshots")
    print("=" * 60)
    print(f"  Last week : {last_week_str} Mon — {last_week_end_str} Sun")
    print(f"  This week : {this_week_str} Mon (current)")

    # ------------------------------------------------------------------
    # 1. Fetch ETFs
    # ------------------------------------------------------------------
    etfs_resp = supabase.table("etfs").select(
        "id, ticker, inception_date, price_at_inception, "
        "roc_latest, death_clock_years, true_income_yield, "
        "headline_yield_ttm, canary_health"
    ).execute()
    etfs = etfs_resp.data or []
    if not etfs:
        print("  ⚠ No ETFs in database — nothing to do.")
        return
    print(f"\n  ✓ {len(etfs)} ETFs loaded")

    # ------------------------------------------------------------------
    # 2. Fetch weekly_data up to last Sunday
    # ------------------------------------------------------------------
    wd_resp = (
        supabase.table("weekly_data")
        .select("ticker_id, date, adj_close, dividend")
        .lte("date", last_week_end_str)
        .order("date", desc=False)
        .execute()
    )
    wd_rows = wd_resp.data or []
    by_ticker: dict[str, list[dict]] = {}
    for row in wd_rows:
        by_ticker.setdefault(row["ticker_id"], []).append(row)
    print(f"  ✓ {len(wd_rows)} weekly_data rows for {len(by_ticker)} tickers")

    # ------------------------------------------------------------------
    # 3. Compute last-week snapshots
    # ------------------------------------------------------------------
    fmp_api_key = os.getenv("FMP_API_KEY")
    fmp = _FMPClient(fmp_api_key) if fmp_api_key else None
    five_years_ago = (last_sunday - timedelta(days=1825)).strftime("%Y-%m-%d")
    one_year_before_end = last_sunday - timedelta(days=365)
    one_year_before_str = one_year_before_end.date().isoformat()

    last_week_snapshots: list[dict] = []
    fmp_fallback_count = 0

    for etf in etfs:
        ticker_id = etf["id"]
        ticker = etf.get("ticker", "?")
        rows = by_ticker.get(ticker_id, [])

        if not rows:
            if fmp:
                try:
                    snap = _last_week_snapshot_from_fmp(
                        ticker_id, ticker, last_sunday, last_week_str, fmp, five_years_ago
                    )
                    if snap:
                        last_week_snapshots.append(snap)
                        fmp_fallback_count += 1
                except Exception:
                    pass
            continue

        # Latest price on or before last Sunday
        latest_row = rows[-1]
        if latest_row["date"] > last_week_end_str:
            continue
        latest_price = float(latest_row["adj_close"])

        # Inception reference
        inception_str = etf.get("inception_date")
        price_at_inception = etf.get("price_at_inception")
        if price_at_inception is not None:
            price_at_inception = float(price_at_inception)
        try:
            inception_dt = (
                datetime.strptime(inception_str[:10], "%Y-%m-%d")
                if inception_str
                else datetime.strptime(rows[0]["date"][:10], "%Y-%m-%d")
            )
        except Exception:
            inception_dt = datetime.strptime(rows[0]["date"][:10], "%Y-%m-%d")
        if price_at_inception is None:
            price_at_inception = float(rows[0]["adj_close"])

        years_since = (last_sunday.date() - inception_dt.date()).days / 365.0
        if years_since < 0:
            continue

        inception_date_str = inception_str[:10] if inception_str else None
        total_divs = sum(
            float(r.get("dividend") or 0)
            for r in rows
            if inception_date_str is None or r["date"] >= inception_date_str
        )
        divs_12mo = sum(
            float(r.get("dividend") or 0)
            for r in rows
            if one_year_before_str <= r["date"] <= last_week_end_str
        )

        roc = _estimate_roc_from_nav_erosion(
            price_at_inception, latest_price, total_divs, years_since
        )

        # 1Y price return from weekly_data
        price_1y_ago_rows = [
            r for r in rows
            if r["date"] >= one_year_before_str
        ]
        price_1y_ago = float(price_1y_ago_rows[0]["adj_close"]) if price_1y_ago_rows else None
        total_return_1y: float | None = None
        if price_1y_ago and price_1y_ago > 0:
            total_return_1y = round(((latest_price / price_1y_ago) - 1) * 100, 2)

        nav_factor = _calculate_nav_trend_factor(total_return_1y)
        eff_roc = _calculate_effective_roc(roc, nav_factor)
        death_clock = _calculate_death_clock(eff_roc, total_return_1y)
        if eff_roc is None and roc is not None and roc <= 0:
            canary = "Healthy"
        else:
            canary = _determine_canary_health(eff_roc, total_return_1y)

        headline = _clamp_numeric((divs_12mo / latest_price) * 100) if latest_price > 0 else None
        true_income = (
            _clamp_numeric(round(headline * (1 - roc / 100), 6))
            if headline is not None and roc is not None
            else None
        )

        last_week_snapshots.append({
            "ticker_id":         ticker_id,
            "week_start_date":   last_week_str,
            "roc_percent":       roc,
            "death_clock_years": death_clock,
            "true_income_yield": true_income,
            "headline_yield_ttm":headline,
            "canary_health":     canary,
        })

    # ------------------------------------------------------------------
    # 4. This-week snapshots — copy live values from etfs table
    # ------------------------------------------------------------------
    this_week_snapshots = [
        {
            "ticker_id":         e["id"],
            "week_start_date":   this_week_str,
            "roc_percent":       e.get("roc_latest"),
            "death_clock_years": e.get("death_clock_years"),
            "true_income_yield": e.get("true_income_yield"),
            "headline_yield_ttm":e.get("headline_yield_ttm"),
            "canary_health":     e.get("canary_health"),
        }
        for e in etfs
    ]

    # ------------------------------------------------------------------
    # 5. Upsert both weeks
    # ------------------------------------------------------------------
    all_snapshots = last_week_snapshots + this_week_snapshots
    print(f"\n  Last-week snapshots built: {len(last_week_snapshots)}", end="")
    if fmp_fallback_count:
        print(f"  (FMP fallback: {fmp_fallback_count})", end="")
    print(f"\n  This-week snapshots built: {len(this_week_snapshots)}")

    print("\nUpserting into etf_weekly_snapshots...")
    batch_size = 500
    total = 0
    for i in range(0, len(all_snapshots), batch_size):
        batch = all_snapshots[i : i + batch_size]
        result = supabase.table("etf_weekly_snapshots").upsert(
            batch, on_conflict="ticker_id,week_start_date"
        ).execute()
        if getattr(result, "error", None):
            raise RuntimeError(f"Upsert error: {result.error}")
        total += len(batch)
        print(f"  ✓ Batch {i // batch_size + 1}: {len(batch)} rows")

    print(f"\n✓ Done. {total} rows upserted into etf_weekly_snapshots.")
    print("=" * 60)


if __name__ == "__main__":
    try:
        update_weekly_snapshots()
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception as e:
        print(f"\nFatal error: {e}")
        raise
