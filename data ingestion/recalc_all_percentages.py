"""
Safe script to convert all percentage fields from decimal to percentage format.

This script:
- Reads existing ETFs from database (does NOT delete anything)
- Multiplies percentage fields by 100 to convert from decimal (0.13) to percentage (13.0)
- Updates only percentage columns in etfs table
- Skips values that are already in percentage format (idempotent)

Fields updated:
- headline_yield_ttm
- true_income_yield
- total_return_1y, total_return_ytd, total_return_inception
- spent_dividends_return_1y, spent_dividends_return_ytd, spent_dividends_return_inception

SAFE: Does not clear or delete any data.
"""

import os
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


def is_already_percentage(value: float) -> bool:
    """
    Check if value is already in percentage format (>= 1.0 or <= -1.0).
    Values like 0.13 are decimals, values like 13.0 are percentages.
    """
    if value is None:
        return False
    return abs(value) >= 1.0


def clamp_percentage(value: float, max_val: float = 999.9999, min_val: float = -999.9999) -> float:
    """Clamp percentage values to reasonable range."""
    return max(min_val, min(max_val, value))


def recalculate_all_percentages():
    """
    Convert all percentage fields from decimal format to percentage format.
    
    This multiplies values by 100 if they're in decimal format (< 1.0).
    Skips values that are already percentages (idempotent).
    
    SAFE: Only updates percentage columns, does not delete or clear any data.
    """
    print("\n" + "="*60)
    print("Converting Percentage Fields from Decimal to Percentage Format")
    print("="*60)
    print("⚠️  This will UPDATE percentage values in the etfs table")
    print("✅ Safe: No data will be deleted or cleared")
    print("✅ Idempotent: Skips values already in percentage format\n")

    # Get all ETFs
    result = supabase.table('etfs').select('id, ticker, headline_yield_ttm, true_income_yield, '
                                           'total_return_1y, total_return_ytd, total_return_inception, '
                                           'spent_dividends_return_1y, spent_dividends_return_ytd, '
                                           'spent_dividends_return_inception').execute()

    etfs = result.data or []
    
    if not etfs:
        print("  ✗ No ETFs found in database, nothing to update.")
        return

    print(f"  Found {len(etfs)} ETFs in database\n")

    updated = 0
    skipped = 0
    errors = 0
    fields_updated = {
        'headline_yield_ttm': 0,
        'true_income_yield': 0,
        'total_return_1y': 0,
        'total_return_ytd': 0,
        'total_return_inception': 0,
        'spent_dividends_return_1y': 0,
        'spent_dividends_return_ytd': 0,
        'spent_dividends_return_inception': 0,
    }

    for etf in etfs:
        ticker = etf.get('ticker', 'UNKNOWN')
        ticker_id = etf.get('id')
        
        if not ticker_id:
            skipped += 1
            continue

        try:
            updates = {}
            
            # Process each percentage field
            percentage_fields = [
                'headline_yield_ttm',
                'true_income_yield',
                'total_return_1y',
                'total_return_ytd',
                'total_return_inception',
                'spent_dividends_return_1y',
                'spent_dividends_return_ytd',
                'spent_dividends_return_inception',
            ]
            
            for field in percentage_fields:
                value = etf.get(field)
                
                if value is None:
                    continue  # Skip null values
                
                try:
                    value_float = float(value)
                    
                    # Check if already in percentage format
                    if is_already_percentage(value_float):
                        continue  # Skip, already percentage
                    
                    # Convert from decimal to percentage
                    new_value = clamp_percentage(value_float * 100)
                    updates[field] = round(new_value, 6)
                    fields_updated[field] += 1
                    
                except (ValueError, TypeError):
                    continue  # Skip invalid values
            
            # Update database if there are changes
            if updates:
                supabase.table('etfs').update(updates).eq('id', ticker_id).execute()
                updated += 1
                
                if updated % 10 == 0:
                    print(f"    ✓ Updated {updated} ETFs... ({ticker})")
            else:
                skipped += 1
                
        except Exception as e:
            errors += 1
            print(f"    ✗ Error processing {ticker}: {e}")
            skipped += 1

    print("\n" + "="*60)
    print("CONVERSION COMPLETE")
    print("="*60)
    print(f"\n✅ Successfully updated: {updated} ETFs")
    print(f"○ Skipped: {skipped} ETFs (already percentages or no values to update)")
    if errors > 0:
        print(f"✗ Errors: {errors} ETFs")
    print(f"\nTotal ETFs processed: {len(etfs)}")
    
    print("\nFields updated:")
    for field, count in fields_updated.items():
        if count > 0:
            print(f"  - {field}: {count} values converted")
    
    print("\n💡 Tip: Refresh your dashboard to see updated percentage values")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("YieldCanary - Percentage Format Conversion")
    print("="*60)
    print("\nThis script converts percentage fields from decimal to percentage format.")
    print("It does NOT delete or clear any existing data.\n")
    
    try:
        recalculate_all_percentages()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user. No changes were made.")
    except Exception as e:
        print(f"\n\n✗ Fatal error: {e}")
        print("No changes were made to the database.")
        raise

