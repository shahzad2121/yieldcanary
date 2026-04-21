"""
Snapshot current-week ETF metrics into etf_weekly_snapshots.

Sole responsibility: copy key metrics from the `etfs` table into
`etf_weekly_snapshots` for the current ISO-week Monday bucket.

etf_monthly_roc is maintained exclusively by snapshot_monthly_roc.py
(monthly cron) and seed_monthly_roc_history.py (one-time seed).
This script does NOT touch etf_monthly_roc.
"""

import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from supabase import create_client, Client


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


def _get_week_start_utc(today: datetime) -> datetime:
    """ISO-week Monday in UTC (canonical week bucket key)."""
    base = datetime(today.year, today.month, today.day, 0, 0, 0, 0)
    return base - timedelta(days=base.weekday())


def snapshot_weekly_etf_metrics() -> None:
    """
    Copy current ETF metrics into etf_weekly_snapshots for this week's bucket.

    Fields copied from etfs:
        roc_latest          → roc_percent
        death_clock_years   → death_clock_years
        true_income_yield   → true_income_yield
        headline_yield_ttm  → headline_yield_ttm
        canary_health       → canary_health

    Keyed by (ticker_id, week_start_date) — idempotent / safe to rerun.
    """
    supabase_url, supabase_key = _validate_env()
    supabase: Client = create_client(supabase_url, supabase_key)

    now_utc = datetime.utcnow()
    week_start_str = _get_week_start_utc(now_utc).date().isoformat()

    print("=" * 60)
    print("Weekly ETF Metrics Snapshot → etf_weekly_snapshots")
    print("=" * 60)
    print(f"  Week bucket (Monday UTC): {week_start_str}")

    response = supabase.table("etfs").select(
        "id, ticker, roc_latest, death_clock_years, true_income_yield, "
        "headline_yield_ttm, canary_health"
    ).execute()

    rows = response.data or []
    if not rows:
        print("  ⚠ No ETFs found in 'etfs' table — nothing to snapshot.")
        return
    print(f"  ✓ {len(rows)} ETFs retrieved")

    snapshots = [
        {
            "ticker_id":        row["id"],
            "week_start_date":  week_start_str,
            "roc_percent":      row.get("roc_latest"),
            "death_clock_years":row.get("death_clock_years"),
            "true_income_yield":row.get("true_income_yield"),
            "headline_yield_ttm":row.get("headline_yield_ttm"),
            "canary_health":    row.get("canary_health"),
        }
        for row in rows
    ]

    batch_size = 500
    total = 0
    for i in range(0, len(snapshots), batch_size):
        batch = snapshots[i : i + batch_size]
        result = supabase.table("etf_weekly_snapshots").upsert(
            batch, on_conflict="ticker_id,week_start_date"
        ).execute()
        if getattr(result, "error", None):
            raise RuntimeError(f"Upsert error: {result.error}")
        total += len(batch)

    print(f"  ✓ Upserted {total} rows into etf_weekly_snapshots")
    print("=" * 60)


if __name__ == "__main__":
    snapshot_weekly_etf_metrics()

