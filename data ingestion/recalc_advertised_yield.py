"""
Recalculate advertised_yield for all ETFs from weekly_data and etfs table.

Formula: (last payout per share × annualization factor) / latest_adj_close × 100
- Annualization: Weekly = 52, Monthly = 12, Quarterly = 4
- Last payout = most recent week with dividend > 0 in weekly_data

Sets advertised_yield to NULL when:
- payout_frequency is NULL
- latest_adj_close is NULL or <= 0
- No recent dividend in weekly_data

Safe: Only updates advertised_yield column. Run after Step 6 (payout_frequency)
and after daily price updates.
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


def clamp_numeric(value: float, max_val: float = 999.9999, min_val: float = -999.9999) -> float:
    """Clamp for NUMERIC(10,6) percentage columns."""
    return max(min_val, min(max_val, value))


def get_annualization_factor(payout_frequency: str | None) -> int | None:
    """Return payouts per year: Weekly=52, Monthly=12, Quarterly=4. None if unknown."""
    if not payout_frequency:
        return None
    f = payout_frequency.strip().lower()
    if f == "weekly":
        return 52
    if f == "monthly":
        return 12
    if f == "quarterly":
        return 4
    return None


def recalculate_advertised_yield() -> None:
    """
    For each ETF: get last payout from weekly_data, payout_frequency and latest_adj_close
    from etfs; compute advertised_yield or set NULL if insufficient data.
    """
    print("\n" + "=" * 60)
    print("Recalculating Advertised Yield")
    print("=" * 60)
    print("Formula: (last payout per share × annualization) / latest price × 100")
    print("NULL when payout_frequency, price, or last payout is missing.\n")

    result = supabase.table("etfs").select("id, ticker, payout_frequency, latest_adj_close").execute()
    etf_rows = result.data or []
    if not etf_rows:
        print("  ○ No ETFs found, nothing to do.")
        return

    updated = 0
    set_null = 0
    errors = 0

    for row in etf_rows:
        ticker_id = row["id"]
        ticker = row["ticker"]
        payout_frequency = row.get("payout_frequency")
        latest_adj_close = row.get("latest_adj_close")

        try:
            # Need valid price and known frequency
            if latest_adj_close is None or float(latest_adj_close) <= 0:
                supabase.table("etfs").update({"advertised_yield": None}).eq("id", ticker_id).execute()
                set_null += 1
                print(f"    ○ {ticker}: no price or price ≤ 0")
                continue

            factor = get_annualization_factor(payout_frequency)
            if factor is None:
                supabase.table("etfs").update({"advertised_yield": None}).eq("id", ticker_id).execute()
                set_null += 1
                print(f"    ○ {ticker}: no payout_frequency or unknown frequency")
                continue

            # Most recent week with a dividend (order date desc, first row with dividend > 0)
            wd = (
                supabase.table("weekly_data")
                .select("date, dividend")
                .eq("ticker_id", ticker_id)
                .order("date", desc=True)
                .execute()
            )
            weekly_rows = wd.data or []
            last_payout = None
            for r in weekly_rows:
                div = r.get("dividend")
                if div is not None:
                    try:
                        v = float(div)
                        if v > 0:
                            last_payout = v
                            break
                    except (TypeError, ValueError):
                        pass

            if last_payout is None or last_payout <= 0:
                supabase.table("etfs").update({"advertised_yield": None}).eq("id", ticker_id).execute()
                set_null += 1
                print(f"    ○ {ticker}: no dividend in weekly_data")
                continue

            price = float(latest_adj_close)
            advertised_yield = (last_payout * factor) / price * 100
            advertised_yield = round(advertised_yield, 6)
            advertised_yield = clamp_numeric(advertised_yield)

            supabase.table("etfs").update({"advertised_yield": advertised_yield}).eq("id", ticker_id).execute()
            updated += 1
            print(f"    ✓ {ticker}: {advertised_yield:.2f}%")

        except Exception as e:
            print(f"    ✗ {ticker}: {e}")
            try:
                supabase.table("etfs").update({"advertised_yield": None}).eq("id", ticker_id).execute()
            except Exception:
                pass
            set_null += 1
            errors += 1

    print(f"  ✓ Advertised yield set for {updated} ETFs")
    if set_null:
        print(f"  ○ Set to NULL for {set_null} ETFs (insufficient data)")
    if errors:
        print(f"  ✗ Errors: {errors}")


if __name__ == "__main__":
    try:
        recalculate_advertised_yield()
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception as e:
        print(f"\nFatal error: {e}")
        raise
