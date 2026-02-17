"""
One-off script to backfill etf_weekly_snapshots with a synthetic "previous week".

Purpose
-------
- The `weekly-movers` Edge Function needs at least **two weeks** of data in
  `etf_weekly_snapshots` to compute week‑over‑week changes.
- Your weekly workflow now runs `snapshot_weekly_etf_metrics.py`, which will
  populate **this week's** snapshot going forward.
- This script creates **one additional snapshot for the previous week** by
  copying the *current* metrics from the `etfs` table and assigning them to
  the previous week's `week_start_date` (previous Monday, UTC).

Notes
-----
- Because we copy today's metrics into last week, the first set of deltas
  will be ~0 for most ETFs. That's expected and avoids complex historical
  reconstruction.
- After the next weekly run, you'll have genuine week‑over‑week changes.

Usage
-----
Run once from the "data ingestion" directory:

    python test-scripts/backfill_previous_week_snapshot.py
"""

import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from supabase import create_client, Client


def _validate_env() -> tuple[str, str]:
  """
  Load and validate Supabase environment variables.

  Mirrors the pattern used in other data ingestion scripts.
  """
  # Try project-root .env.local (parent of this script's directory)
  load_dotenv("../.env.local")
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
  Get the canonical week_start_date (Monday, UTC) for a given date.

  Same convention as snapshot_weekly_etf_metrics.py.
  """
  base = datetime(
    year=today.year,
    month=today.month,
    day=today.day,
    hour=0,
    minute=0,
    second=0,
    microsecond=0,
  )
  weekday = base.weekday()  # Monday = 0, Sunday = 6
  return base - timedelta(days=weekday)


def _get_previous_week_start_utc(today: datetime) -> datetime:
  """
  Get the week_start_date for the previous week (one week before current Monday).
  """
  this_week_start = _get_week_start_utc(today)
  return this_week_start - timedelta(days=7)


def backfill_previous_week_snapshot() -> None:
  """
  Copy current ETF metrics into etf_weekly_snapshots for the *previous* week.

  For each row in etfs, we insert/upsert:
    - ticker_id         -> ticker_id
    - previous week     -> week_start_date
    - roc_latest        -> roc_percent
    - death_clock_years -> death_clock_years
    - true_income_yield -> true_income_yield
    - headline_yield_ttm-> headline_yield_ttm
    - canary_health     -> canary_health

  Safe: Uses upsert on (ticker_id, week_start_date).
  """
  supabase_url, supabase_key = _validate_env()
  supabase: Client = create_client(supabase_url, supabase_key)

  now_utc = datetime.utcnow()
  prev_week_start = _get_previous_week_start_utc(now_utc)
  prev_week_str = prev_week_start.date().isoformat()

  print("=" * 60)
  print("Backfill Previous Week Snapshot")
  print("=" * 60)
  print(f"  Previous week_start_date (UTC, Monday): {prev_week_str}")

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
        "week_start_date": prev_week_str,
        "roc_percent": row.get("roc_latest"),
        "death_clock_years": row.get("death_clock_years"),
        "true_income_yield": row.get("true_income_yield"),
        "headline_yield_ttm": row.get("headline_yield_ttm"),
        "canary_health": row.get("canary_health"),
      }
    )

  # 3. Upsert snapshots into etf_weekly_snapshots in batches
  print("\nUpserting previous-week snapshots into 'etf_weekly_snapshots'...")
  batch_size = 500
  total_upserted = 0

  for i in range(0, len(snapshots), batch_size):
    batch = snapshots[i : i + batch_size]
    result = supabase.table("etf_weekly_snapshots").upsert(
      batch,
      on_conflict="ticker_id,week_start_date",
    ).execute()

    # supabase-py v2+ uses 'error' attribute; guard just in case
    if getattr(result, "error", None):
      raise RuntimeError(f"Upsert error: {result.error}")

    total_upserted += len(batch)
    print(f"  ✓ Upserted batch {i // batch_size + 1}: {len(batch)} rows")

  print("\nBackfill complete.")
  print(f"  Previous week_start_date: {prev_week_str}")
  print(f"  Total ETFs snapshotted: {total_upserted}")
  print("=" * 60)


if __name__ == "__main__":
  try:
    backfill_previous_week_snapshot()
  except KeyboardInterrupt:
    print("\nInterrupted.")
  except Exception as e:
    print(f"\nFatal error: {e}")
    raise

