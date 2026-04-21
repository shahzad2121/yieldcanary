"""
Backfill etf_monthly_roc from etf_weekly_snapshots.

Purpose
-------
- Seed monthly ROC history for weighted-ROC calculations.
- For each (ticker, month), pick the latest weekly snapshot inside that month.
- Upsert into etf_monthly_roc using (ticker_id, month_start_date).

Usage
-----
Run from project root:

    python "data ingestion/backfill_monthly_roc_from_weekly_snapshots.py"

Optional args:
    --lookback-months 18
"""

from __future__ import annotations

import argparse
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from supabase import Client, create_client


def _validate_env() -> tuple[str, str]:
    load_dotenv(".env.local")
    supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    missing: list[str] = []
    if not supabase_url:
        missing.append("SUPABASE_URL or VITE_SUPABASE_URL")
    if not supabase_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")

    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}"
        )

    return supabase_url, supabase_key


def _month_start(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return dt.replace(day=1).date().isoformat()


def _fetch_weekly_snapshots(
    supabase: Client,
    min_week_start: str,
    page_size: int = 1000,
) -> list[dict]:
    all_rows: list[dict] = []
    offset = 0

    while True:
        response = (
            supabase.table("etf_weekly_snapshots")
            .select("ticker_id,week_start_date,roc_percent")
            .gte("week_start_date", min_week_start)
            .order("week_start_date", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        rows = response.data or []
        if not rows:
            break

        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    return all_rows


def backfill_monthly_roc_from_weekly_snapshots(lookback_months: int = 18) -> None:
    supabase_url, supabase_key = _validate_env()
    supabase: Client = create_client(supabase_url, supabase_key)

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    approx_start = today - timedelta(days=lookback_months * 31)
    min_week_start = approx_start.date().isoformat()

    print("=" * 70)
    print("Backfill Monthly ROC From Weekly Snapshots")
    print("=" * 70)
    print(f"Lookback months: {lookback_months}")
    print(f"Min week_start_date: {min_week_start}")

    weekly_rows = _fetch_weekly_snapshots(supabase, min_week_start=min_week_start)
    if not weekly_rows:
        print("No weekly snapshots found for requested window. Nothing to backfill.")
        return

    print(f"Fetched weekly rows: {len(weekly_rows)}")

    # Pick latest weekly snapshot per (ticker_id, month_start_date)
    monthly_latest: dict[tuple[str, str], dict] = {}

    for row in weekly_rows:
        ticker_id = row.get("ticker_id")
        week_start = row.get("week_start_date")
        roc_percent = row.get("roc_percent")

        if not ticker_id or not week_start:
            continue
        if roc_percent is None:
            continue

        month_start = _month_start(week_start)
        key = (ticker_id, month_start)

        prev = monthly_latest.get(key)
        if prev is None or week_start > prev["source_week_start_date"]:
            monthly_latest[key] = {
                "ticker_id": ticker_id,
                "month_start_date": month_start,
                "roc_percent": roc_percent,
                "source_week_start_date": week_start,
            }

    monthly_rows = list(monthly_latest.values())
    if not monthly_rows:
        print("No valid monthly rows built (all weekly rows had null/missing ROC).")
        return

    print(f"Monthly rows to upsert: {len(monthly_rows)}")

    batch_size = 500
    total = 0
    for i in range(0, len(monthly_rows), batch_size):
        batch = monthly_rows[i : i + batch_size]
        result = (
            supabase.table("etf_monthly_roc")
            .upsert(batch, on_conflict="ticker_id,month_start_date")
            .execute()
        )
        if getattr(result, "error", None):
            raise RuntimeError(f"Monthly upsert error: {result.error}")
        total += len(batch)
        print(f"  Upserted batch {i // batch_size + 1}: {len(batch)}")

    print("-" * 70)
    print(f"Done. Upserted monthly ROC rows: {total}")
    print("=" * 70)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill etf_monthly_roc from etf_weekly_snapshots."
    )
    parser.add_argument(
        "--lookback-months",
        type=int,
        default=18,
        help="How many months of weekly snapshots to scan (default: 18).",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    backfill_monthly_roc_from_weekly_snapshots(lookback_months=max(1, args.lookback_months))
