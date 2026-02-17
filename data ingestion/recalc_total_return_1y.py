"""
One-off script to correct total_return_1y in the database.

Recomputes:

    total_return_1y = ((latest_adj_close / price_1y_ago) - 1) * 100

for each ETF, using the existing latest_adj_close and price_1y_ago values
already stored in the etfs table. Uses the same wide clamp as
bootstrap_database.py (±9999.9999) so values are not artificially capped
at ±10%.

Run once after fixing clamp_numeric in bootstrap_database.py to correct
historically clamped rows. Safe: Only updates total_return_1y.
"""

import os
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


def clamp_numeric(value: float, max_val: float = 9999.9999, min_val: float = -9999.9999) -> float:
    """Clamp for NUMERIC(10,6) percentage columns (matches bootstrap_database.py)."""
    return max(min_val, min(max_val, value))


def recalculate_total_return_1y() -> None:
    """
    For each ETF: recompute total_return_1y from latest_adj_close and price_1y_ago; update DB.

    total_return_1y = ((latest_adj_close / price_1y_ago) - 1) * 100
    """
    print("\n" + "=" * 60)
    print("Recalculating Total Return 1Y (one-off correction)")
    print("=" * 60)
    print("Formula: ((latest_adj_close / price_1y_ago) - 1) * 100")
    print("Clamp: ±9999.9999 (no artificial ±10% cap).\n")

    result = supabase.table("etfs").select("id, ticker, latest_adj_close, price_1y_ago").execute()
    rows = result.data or []
    if not rows:
        print("  ○ No ETFs found, nothing to do.")
        return

    updated = 0
    skipped = 0
    errors = 0

    for row in rows:
        ticker_id = row["id"]
        ticker = row["ticker"]
        latest = row.get("latest_adj_close")
        price_1y_ago = row.get("price_1y_ago")

        try:
            if latest is None or price_1y_ago is None or float(price_1y_ago) <= 0:
                skipped += 1
                print(f"    ○ {ticker}: missing or invalid latest_adj_close / price_1y_ago")
                continue

            total_return_1y = ((float(latest) / float(price_1y_ago)) - 1) * 100.0
            total_return_1y = round(total_return_1y, 2)
            total_return_1y = clamp_numeric(total_return_1y)

            supabase.table("etfs").update(
                {"total_return_1y": total_return_1y}
            ).eq("id", ticker_id).execute()

            updated += 1
            print(f"    ✓ {ticker}: {total_return_1y:.2f}%")

        except Exception as e:
            print(f"    ✗ {ticker}: {e}")
            errors += 1

    print("\n" + "=" * 60)
    print("RECALCULATION COMPLETE")
    print("=" * 60)
    print(f"\n  ✓ Updated {updated} ETFs")
    if skipped:
        print(f"  ○ Skipped {skipped} ETFs (missing or invalid data)")
    if errors:
        print(f"  ✗ Errors: {errors}")
    print(f"\n  Total processed: {len(rows)}")


if __name__ == "__main__":
    try:
        recalculate_total_return_1y()
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception as e:
        print(f"\nFatal error: {e}")
        raise

