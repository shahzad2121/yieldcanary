import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from supabase import create_client, Client


def _validate_env() -> tuple[str, str]:
    """
    Load and validate Supabase environment variables.

    Mirrors the pattern used in other data ingestion scripts, but kept
    self-contained so this script can run independently on a schedule.
    """
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
    """
    Get the canonical week_start_date for snapshots.

    We use ISO week Monday in UTC as the "start of week" so that:
    - The same date is used regardless of where the script runs.
    - Joins between weeks are straightforward.
    """
    # Normalize to UTC midnight first
    base = datetime(
        year=today.year,
        month=today.month,
        day=today.day,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    # Monday is 0, Sunday is 6
    weekday = base.weekday()
    return base - timedelta(days=weekday)


def snapshot_weekly_etf_metrics() -> None:
    """
    Take a weekly snapshot of key ETF metrics into etf_weekly_snapshots.

    For each row in etfs, we copy:
      - roc_latest          -> roc_percent
      - death_clock_years   -> death_clock_years
      - true_income_yield   -> true_income_yield
      - headline_yield_ttm  -> headline_yield_ttm
      - canary_health       -> canary_health

    Snapshot is keyed by (ticker_id, week_start_date), so running this script
    multiple times in the same week will simply upsert into the same rows.
    """
    supabase_url, supabase_key = _validate_env()
    supabase: Client = create_client(supabase_url, supabase_key)

    now_utc = datetime.utcnow()
    week_start = _get_week_start_utc(now_utc)
    week_start_str = week_start.date().isoformat()

    print("=" * 60)
    print("Weekly ETF Metrics Snapshot")
    print("=" * 60)
    print(f"  Week start (UTC, Monday): {week_start_str}")

    # 1. Fetch current metrics from etfs
    print("\nFetching current ETF metrics from 'etfs' table...")
    response = supabase.table("etfs").select(
        "id, ticker, roc_latest, death_clock_years, true_income_yield, "
        "headline_yield_ttm, canary_health"
    ).execute()

    rows = response.data or []
    if not rows:
        print("  ⚠ No ETFs found in 'etfs' table. Nothing to snapshot.")
        return

    print(f"  ✓ Retrieved {len(rows)} ETFs")

    # 2. Build snapshot records
    snapshots: list[dict] = []
    for row in rows:
        snapshots.append(
            {
                "ticker_id": row["id"],
                "week_start_date": week_start_str,
                "roc_percent": row.get("roc_latest"),
                "death_clock_years": row.get("death_clock_years"),
                "true_income_yield": row.get("true_income_yield"),
                "headline_yield_ttm": row.get("headline_yield_ttm"),
                "canary_health": row.get("canary_health"),
            }
        )

    # 3. Upsert snapshots into etf_weekly_snapshots in batches
    print("\nUpserting snapshots into 'etf_weekly_snapshots'...")
    batch_size = 500
    total_upserted = 0

    for i in range(0, len(snapshots), batch_size):
        batch = snapshots[i : i + batch_size]
        result = supabase.table("etf_weekly_snapshots").upsert(
            batch,
            on_conflict="ticker_id,week_start_date",
        ).execute()

        if getattr(result, "error", None):
            raise RuntimeError(f"Upsert error: {result.error}")

        total_upserted += len(batch)
        print(f"  ✓ Upserted batch {i // batch_size + 1}: {len(batch)} rows")

    print("\nSnapshot complete.")
    print(f"  Week start: {week_start_str}")
    print(f"  Total ETFs snapshotted: {total_upserted}")
    print("=" * 60)


if __name__ == "__main__":
    snapshot_weekly_etf_metrics()

