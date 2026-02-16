"""
Recalculate price_avg_90d for all ETFs from weekly_data.

For each ETF: average adj_close over the last 90 days; update etfs.price_avg_90d.
Sets price_avg_90d to NULL when there are no rows in the 90-day window.

Run after populate_weekly_data (Step 5). Safe: only updates price_avg_90d column.
"""

import os
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

script_dir = Path(__file__).parent
project_root = script_dir.parent
env_path = project_root / ".env.local"
load_dotenv(env_path)

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("SUPABASE_KEY")
)

if not SUPABASE_URL:
    raise EnvironmentError("Missing VITE_SUPABASE_URL or SUPABASE_URL")
if not SUPABASE_KEY:
    raise EnvironmentError("Missing SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def recalculate_price_avg_90d() -> None:
    """For each ETF: get last 90 days from weekly_data, average adj_close, update etfs.price_avg_90d."""
    print("\n" + "=" * 60)
    print("Recalculating 90-Day Average Price")
    print("=" * 60)
    print("Source: weekly_data (last 90 days). NULL when insufficient data.\n")

    result = supabase.table("etfs").select("id, ticker").execute()
    etf_rows = result.data or []
    if not etf_rows:
        print("  ○ No ETFs found, nothing to do.")
        return

    today = datetime.now().date()
    start_date = (today - timedelta(days=90)).strftime("%Y-%m-%d")
    end_date = today.strftime("%Y-%m-%d")
    print(f"  Date range: {start_date} to {end_date}")
    print(f"  Processing {len(etf_rows)} ETFs…\n")

    updated = 0
    set_null = 0
    errors = 0

    for row in etf_rows:
        ticker_id = row["id"]
        ticker = row["ticker"]

        try:
            wd = (
                supabase.table("weekly_data")
                .select("adj_close")
                .eq("ticker_id", ticker_id)
                .gte("date", start_date)
                .lte("date", end_date)
                .execute()
            )
            rows = wd.data or []
            if not rows:
                supabase.table("etfs").update({"price_avg_90d": None}).eq("id", ticker_id).execute()
                set_null += 1
                print(f"    ○ {ticker}: no data in last 90 days")
                continue

            total = sum(float(r.get("adj_close", 0) or 0) for r in rows)
            avg = round(total / len(rows), 4)
            supabase.table("etfs").update({"price_avg_90d": avg}).eq("id", ticker_id).execute()
            updated += 1
            print(f"    ✓ {ticker}: ${avg:.2f} ({len(rows)} days)")

        except Exception as e:
            print(f"    ✗ {ticker}: {e}")
            try:
                supabase.table("etfs").update({"price_avg_90d": None}).eq("id", ticker_id).execute()
            except Exception:
                pass
            set_null += 1
            errors += 1

    print("\n" + "=" * 60)
    print("RECALCULATION COMPLETE")
    print("=" * 60)
    print(f"\n  ✓ 90-day avg set for {updated} ETFs")
    if set_null:
        print(f"  ○ Set to NULL for {set_null} ETFs (no data in last 90 days)")
    if errors:
        print(f"  ✗ Errors: {errors}")
    print(f"\n  Total ETFs processed: {len(etf_rows)}")


if __name__ == "__main__":
    try:
        recalculate_price_avg_90d()
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception as e:
        print(f"\nFatal error: {e}")
        raise
