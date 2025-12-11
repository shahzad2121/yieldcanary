"""
YieldCanary - Print ETFs Table Data
Displays current ETF data from Supabase for monitoring/debugging.
"""

import os
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def print_etfs_summary():
    """Print summary of all ETFs"""
    print(f"\n{'='*80}")
    print(f"YieldCanary ETF Data - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}\n")
    
    # Get all ETFs ordered by ticker
    result = supabase.table('etfs').select('*').order('ticker').execute()
    
    if not result.data:
        print("No ETF data found!")
        return
    
    # Print header
    print(f"{'Ticker':<8} {'Name':<40} {'Price':>10} {'ROC%':>8} {'Health':<10} {'Yield':>10} {'1Y Ret':>10}")
    print("-" * 100)
    
    # Count by health status
    health_counts = {'Healthy': 0, 'Dying': 0, 'Dead': 0, 'Unknown': 0}
    
    for etf in result.data:
        ticker = etf.get('ticker', '')
        name = (etf.get('name') or '')[:38]
        price = etf.get('latest_adj_close')
        roc = etf.get('roc_latest')
        health = etf.get('canary_health', 'Unknown')
        headline_yield = etf.get('headline_yield_ttm')
        total_return_1y = etf.get('total_return_1y')
        
        price_str = f"${price:.2f}" if price else "N/A"
        roc_str = f"{roc:.1f}%" if roc else "N/A"
        yield_str = f"{headline_yield*100:.1f}%" if headline_yield else "N/A"
        return_str = f"{total_return_1y*100:.1f}%" if total_return_1y else "N/A"
        
        print(f"{ticker:<8} {name:<40} {price_str:>10} {roc_str:>8} {health:<10} {yield_str:>10} {return_str:>10}")
        
        health_counts[health] = health_counts.get(health, 0) + 1
    
    # Print summary
    print("-" * 100)
    print(f"\nTotal ETFs: {len(result.data)}")
    print(f"  Healthy: {health_counts.get('Healthy', 0)}")
    print(f"  Dying:   {health_counts.get('Dying', 0)}")
    print(f"  Dead:    {health_counts.get('Dead', 0)}")
    print(f"  Unknown: {health_counts.get('Unknown', 0)}")


def print_top_performers():
    """Print top and bottom performers"""
    print(f"\n{'='*80}")
    print("TOP 5 - Best Take-Home Cash Return (1Y)")
    print(f"{'='*80}")
    
    result = supabase.table('etfs')\
        .select('ticker, name, take_home_cash_return_1y, canary_health')\
        .not_.is_('take_home_cash_return_1y', 'null')\
        .order('take_home_cash_return_1y', desc=True)\
        .limit(5)\
        .execute()
    
    for i, etf in enumerate(result.data, 1):
        ret = etf['take_home_cash_return_1y'] * 100
        print(f"{i}. {etf['ticker']:<8} {ret:>8.1f}%  ({etf['canary_health']})")
    
    print(f"\n{'='*80}")
    print("BOTTOM 5 - Worst Take-Home Cash Return (1Y)")
    print(f"{'='*80}")
    
    result = supabase.table('etfs')\
        .select('ticker, name, take_home_cash_return_1y, canary_health')\
        .not_.is_('take_home_cash_return_1y', 'null')\
        .order('take_home_cash_return_1y', desc=False)\
        .limit(5)\
        .execute()
    
    for i, etf in enumerate(result.data, 1):
        ret = etf['take_home_cash_return_1y'] * 100
        print(f"{i}. {etf['ticker']:<8} {ret:>8.1f}%  ({etf['canary_health']})")


def print_danger_zone():
    """Print ETFs in danger zone (Dead or Dying)"""
    print(f"\n{'='*80}")
    print("DANGER ZONE - Dead & Dying ETFs")
    print(f"{'='*80}")
    
    result = supabase.table('etfs')\
        .select('ticker, name, roc_latest, death_clock_years, canary_health')\
        .in_('canary_health', ['Dead', 'Dying'])\
        .order('roc_latest', desc=True)\
        .execute()
    
    if not result.data:
        print("No ETFs in danger zone!")
        return
    
    print(f"{'Ticker':<8} {'Name':<35} {'ROC%':>8} {'Death Clock':>12} {'Status':<10}")
    print("-" * 80)
    
    for etf in result.data:
        name = (etf.get('name') or '')[:33]
        roc = etf.get('roc_latest', 0)
        death = etf.get('death_clock_years')
        health = etf.get('canary_health')
        
        death_str = f"{death:.1f} yrs" if death else "N/A"
        print(f"{etf['ticker']:<8} {name:<35} {roc:>7.1f}% {death_str:>12} {health:<10}")


if __name__ == "__main__":
    print_etfs_summary()
    print_top_performers()
    print_danger_zone()
