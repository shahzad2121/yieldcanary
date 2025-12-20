"""
Safe script to recalculate headline_yield_ttm from weekly_data table.

This script:
- Reads existing ETFs from database (does NOT delete anything)
- Queries weekly_data table for dividends and prices
- Recalculates headline_yield_ttm = SUM(dividends last 365 days) / latest price
- Updates only the headline_yield_ttm column in etfs table

SAFE: Does not clear or delete any data.
"""

import os
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from project root
script_dir = Path(__file__).parent
project_root = script_dir.parent
env_path = project_root / '.env.local'
load_dotenv(env_path)

# Configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = (
    os.getenv('SUPABASE_SERVICE_ROLE_KEY') or 
    os.getenv('SUPABASE_SERVICE_KEY') or
    os.getenv('SUPABASE_KEY')
)

# Validate required environment variables
if not SUPABASE_URL:
    raise EnvironmentError("Missing required environment variable: VITE_SUPABASE_URL or SUPABASE_URL")
if not SUPABASE_KEY:
    raise EnvironmentError("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def clamp_numeric(value: float, max_val: float = 999.9999, min_val: float = -999.9999) -> float:
    """Clamp numeric values to fit database NUMERIC(10,6) constraints for percentage values."""
    return max(min_val, min(max_val, value))


def get_etf_id_map() -> dict:
    """Get mapping of ticker -> id from etfs table"""
    result = supabase.table('etfs').select('id, ticker').execute()
    return {row['ticker']: row['id'] for row in result.data} if result.data else {}


def recalculate_headline_yield_from_weekly_data():
    """
    Recalculate headline_yield_ttm for all ETFs using the weekly_data table.
    
    Formula (per client):
      Headline Yield = SUM(dividends last 365 days) / latest adjusted price
    
    This uses the canonical dividend history stored in Supabase weekly_data table
    rather than external API data.
    
    SAFE: Only updates headline_yield_ttm column, does not delete or clear any data.
    """
    print("\n" + "="*60)
    print("Recalculating Headline Yield (TTM) from weekly_data...")
    print("="*60)
    print("⚠️  This will UPDATE headline_yield_ttm values in the etfs table")
    print("✅ Safe: No data will be deleted or cleared\n")

    today = datetime.now().date()
    one_year_ago = today - timedelta(days=365)
    start_str = one_year_ago.strftime('%Y-%m-%d')
    end_str = today.strftime('%Y-%m-%d')

    # Get mapping of ticker -> id once
    ticker_id_map = get_etf_id_map()

    if not ticker_id_map:
        print("  ✗ No ETFs found in database, nothing to recalculate.")
        return

    print(f"  Found {len(ticker_id_map)} ETFs in database\n")

    updated = 0
    skipped = 0
    errors = 0

    for ticker, ticker_id in ticker_id_map.items():
        try:
            # Fetch all weekly rows for the last 365 days, newest first
            result = (
                supabase
                .table('weekly_data')
                .select('adj_close, date, dividend')
                .eq('ticker_id', ticker_id)
                .gte('date', start_str)
                .lte('date', end_str)
                .order('date', desc=True)
                .execute()
            )

            rows = result.data or []
            if not rows:
                skipped += 1
                if updated % 50 == 0 or skipped == 1:
                    print(f"    ○ {ticker}: No weekly_data found, skipping")
                continue

            # Latest price is the adj_close from the most recent row
            latest_row = rows[0]
            latest_price = latest_row.get('adj_close')

            if not latest_price or latest_price <= 0:
                skipped += 1
                if updated % 50 == 0 or skipped == 1:
                    print(f"    ○ {ticker}: No valid price data, skipping")
                continue

            # Sum all non-null dividends in the period
            total_dividends = 0.0
            dividend_count = 0
            for row in rows:
                div = row.get('dividend')
                if div is not None:
                    total_dividends += float(div)
                    dividend_count += 1

            # If there were no dividends, skip (keep existing value)
            if total_dividends <= 0:
                skipped += 1
                if updated % 50 == 0 or skipped == 1:
                    print(f"    ○ {ticker}: No dividends in last 365 days, skipping")
                continue

            # Calculate headline yield (multiply by 100 to store as percentage)
            headline_yield_ttm = round((total_dividends / float(latest_price)) * 100, 6)
            # Clamp for percentage values (max 999.9999%, min -999.9999%)
            headline_yield_ttm = clamp_numeric(headline_yield_ttm, max_val=999.9999, min_val=-999.9999)

            # Update the etfs table
            supabase.table('etfs').update(
                {'headline_yield_ttm': headline_yield_ttm}
            ).eq('id', ticker_id).execute()

            updated += 1
            if updated % 10 == 0:
                print(f"    ✓ Updated {updated} ETFs... ({ticker}: {headline_yield_ttm:.2f}%)")

        except Exception as e:
            errors += 1
            print(f"    ✗ Error processing {ticker}: {e}")
            skipped += 1

    print("\n" + "="*60)
    print("RECALCULATION COMPLETE")
    print("="*60)
    print(f"\n✅ Successfully updated: {updated} ETFs")
    if skipped > 0:
        print(f"○ Skipped: {skipped} ETFs (no data or no dividends)")
    if errors > 0:
        print(f"✗ Errors: {errors} ETFs")
    print(f"\nTotal ETFs processed: {len(ticker_id_map)}")
    print("\n💡 Tip: Refresh your dashboard to see updated headline yield values")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("YieldCanary - Headline Yield Recalculation")
    print("="*60)
    print("\nThis script recalculates headline_yield_ttm from weekly_data table.")
    print("It does NOT delete or clear any existing data.\n")
    
    try:
        recalculate_headline_yield_from_weekly_data()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user. No changes were made.")
    except Exception as e:
        print(f"\n\n✗ Fatal error: {e}")
        print("No changes were made to the database.")
        raise

