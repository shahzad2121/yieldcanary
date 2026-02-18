"""
One-off script to populate etf_weekly_snapshots with real last-week and this-week data.

Purpose
-------
- The weekly-movers Edge Function needs two weeks of data with DIFFERENT values
  to show meaningful ROC / Death Clock / True Income deltas.
- This script computes last week's metrics from weekly_data (prices + dividends)
  using the same formulas as bootstrap, and uses current etfs for this week.
- After running once, the normal snapshot_weekly_etf_metrics.py workflow takes over;
  from next week onward everything works as usual.

Usage
-----
Run once from project root:

    python "data ingestion/backfill_weekly_snapshots_real.py"
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from supabase import create_client, Client


# ---- Copy of helper functions from bootstrap_database.py (keeps script self-contained) ----

def _determine_canary_health(roc_percent: Optional[float]) -> str:
    if roc_percent is None:
        return "Unknown"
    if roc_percent >= 40:
        return "Dead"
    if roc_percent >= 20:
        return "Dying"
    return "Healthy"


def _calculate_death_clock(roc_percent: Optional[float]) -> Optional[float]:
    if roc_percent is None or roc_percent <= 0:
        return None
    return round(50 / roc_percent, 2)


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

    # 3. Compute last week metrics for each ETF
    last_week_snapshots: list[dict] = []
    one_year_before_end = last_week_end - timedelta(days=365)
    one_year_before_str = one_year_before_end.date().isoformat()

    for etf in etfs:
        ticker_id = etf["id"]
        ticker = etf.get("ticker", "?")
        inception_str = etf.get("inception_date")
        price_at_inception = etf.get("price_at_inception")
        if price_at_inception is not None:
            price_at_inception = float(price_at_inception)

        rows = by_ticker.get(ticker_id, [])
        if not rows:
            continue

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
