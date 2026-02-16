"""
One-off script to correct true_income_yield in the database.

Recomputes true_income_yield = headline_yield_ttm * (1 - roc_latest/100) for each ETF
using existing headline_yield_ttm and roc_latest. Uses the same clamp as bootstrap
(±9999.9999) so values above 10% are stored correctly.

Run once after fixing the clamp in bootstrap_database.py to correct existing rows.
Safe: Only updates true_income_yield column.
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


def recalculate_true_income_yield() -> None:
    """For each ETF: recompute true_income_yield from headline_yield_ttm and roc_latest; update DB."""
    print("\n" + "=" * 60)
    print("Recalculating True Income Yield (one-off correction)")
    print("=" * 60)
    print("Formula: headline_yield_ttm * (1 - roc_latest/100)")
    print("Clamp: ±9999.9999 (allows values > 10%).\n")

    result = supabase.table("etfs").select("id, ticker, headline_yield_ttm, roc_latest").execute()
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
        headline_yield_ttm = row.get("headline_yield_ttm")
        roc_latest = row.get("roc_latest")

        try:
            if headline_yield_ttm is None or roc_latest is None:
                skipped += 1
                print(f"    ○ {ticker}: missing headline_yield_ttm or roc_latest")
                continue

            true_income_yield = round(
                float(headline_yield_ttm) * (1 - float(roc_latest) / 100), 2
            )
            true_income_yield = clamp_numeric(true_income_yield)

            supabase.table("etfs").update(
                {"true_income_yield": true_income_yield}
            ).eq("id", ticker_id).execute()

            updated += 1
            print(f"    ✓ {ticker}: {true_income_yield:.2f}%")

        except Exception as e:
            print(f"    ✗ {ticker}: {e}")
            errors += 1

    print("\n" + "=" * 60)
    print("RECALCULATION COMPLETE")
    print("=" * 60)
    print(f"\n  ✓ Updated {updated} ETFs")
    if skipped:
        print(f"  ○ Skipped {skipped} ETFs (missing data)")
    if errors:
        print(f"  ✗ Errors: {errors}")
    print(f"\n  Total processed: {len(rows)}")


if __name__ == "__main__":
    try:
        recalculate_true_income_yield()
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception as e:
        print(f"\nFatal error: {e}")
        raise
