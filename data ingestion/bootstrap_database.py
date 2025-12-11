"""
YieldCanary Database Bootstrap Script
=====================================
This script:
1. Clears all existing data from tables (etfs, weekly_data, notices_19a1)
2. Adds new tickers to the database
3. Fetches and populates all ETF data systematically

Usage:
    python bootstrap_database.py                    # Use default ticker list
    python bootstrap_database.py tickers.txt       # Load tickers from file (one per line)
    python bootstrap_database.py TSLY,NVDY,CONY    # Comma-separated tickers
"""

import os
import sys
import requests
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv('.env.local')

# Configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
FMP_API_KEY = os.getenv('FMP_API_KEY')

# Validate required environment variables
def validate_env():
    missing = []
    if not SUPABASE_URL:
        missing.append('SUPABASE_URL or VITE_SUPABASE_URL')
    if not SUPABASE_KEY:
        missing.append('SUPABASE_SERVICE_ROLE_KEY')
    if not FMP_API_KEY:
        missing.append('FMP_API_KEY')
    if missing:
        raise EnvironmentError(f"Missing required environment variables: {', '.join(missing)}")

validate_env()

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# Default comprehensive ticker list - high-yield income ETFs
DEFAULT_TICKERS = [
    # YieldMax ETFs
    "TSLY", "NVDY", "CONY", "MSTY", "AMZY", "GOOY", "APLY", "DISO", "NFLY", "PYPY",
    "FBY", "GDXY", "SQY", "MRNY", "AMDY", "SNOY", "BABO", "MARO", "PLTY", "XOMO",
    "YMAX", "YMAG", "LFGY", "JPMO", "MSFO", "AIYY", "AIPI", "FIVY", "FEAT",
    "OARK", "ABNY", "GPTY", "ULTY", "CRSH", "FIAT", "DIPS",
    
    # Defiance ETFs
    "QQQY", "JEPY", "IWMY", "SPYT", "WDTE", "USOY",
    
    # Roundhill ETFs  
    "XDTE", "QDTE", "RDTE", "YBTC", "MDTE", "TDTE",
    
    # REX Shares ETFs
    "FEPI",
    
    # Kurv ETFs
    "TSLP", "NVDP", "MSFT", "AAPY", "AMZP", "GOGL", "NFLP", "METAP",
    "AAPU", "NVDU", "TSLU", "MSFU", "AMZU", "GOGU",
    
    # First Trust / Global X / Other
    "JEPI", "JEPQ", "XYLD", "QYLD", "RYLD", "DIVO", "SVOL",
    "QYLG", "XYLG", "RYLG",
    
    # Newer high-yield ETFs
    "SPYI", "QQQI", "IWMI",
    "CSHI", "BNDI",
    
    # Amplify / Simplify
    "YYY", "SPHY", "ZHDG",
    
    # Weekly payers
    "WKLY", "PMAY", "PJUN", "PAUG", "PSEP", "POCT", "PNOV", "PDEC",
    
    # Bitcoin/Crypto
    "BITO", "BITX", "BITI",
    
    # Leveraged income
    "TQQQ", "SQQQ", "UVXY", "SVXY",
    
    # Sector specific
    "QQQM", "SCHD", "VYM", "DVY", "HDV",
    
    # Additional income ETFs
    "NUSI", "PUTW", "QRMI", "XRMI",
    
    # More YieldMax additions
    "AMDW", "AVGW", "AMZW", "BRKW", "GLDW", "METW", "MSFW", "NFLW", "UNHW",
    "HOOW", "GOOW", "TSLW", "COIW",
    
    # Newer weekly income
    "WNTR", "RDYY", "WPAY", "SOXY",
    
    # Additional tickers
    "BIGY", "CHAT", "MAGS", "METV", "WEED", "NERD", "QTUM", "SIXG",
    "ARM", "AVGX", "BRKC", "HIMZ", "HOOX", "HOOY", "IONX", "LLYX",
    "MSTX", "ORCX", "YQQQ", "SMST", "XYZY", "MAGC", "HUMN", "MEME", "UX", "XDIV"
]


class FMPClient:
    """Financial Modeling Prep API Client - Using Stable API endpoints"""
    
    BASE_URL = "https://financialmodelingprep.com/stable"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    def _request(self, endpoint: str, params: dict = None) -> list:
        """Make API request with error handling"""
        if params is None:
            params = {}
        params['apikey'] = self.api_key
        
        url = f"{self.BASE_URL}/{endpoint}"
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    
    def get_etf_profile(self, ticker: str) -> Optional[dict]:
        """Get ETF profile including name, inception date, AUM, expense ratio"""
        try:
            data = self._request("profile", {'symbol': ticker})
            if data and len(data) > 0:
                return data[0]
        except Exception as e:
            print(f"    Error fetching profile for {ticker}: {e}")
        return None
    
    def get_etf_info(self, ticker: str) -> Optional[dict]:
        """Get ETF-specific info (inception date, expense ratio, AUM)"""
        try:
            data = self._request("etf/info", {'symbol': ticker})
            if data and len(data) > 0:
                return data[0]
        except Exception as e:
            print(f"    Error fetching ETF info for {ticker}: {e}")
        return None
    
    def get_historical_prices(self, ticker: str, from_date: str = None, to_date: str = None) -> list:
        """Get historical EOD prices"""
        try:
            params = {'symbol': ticker}
            if from_date:
                params['from'] = from_date
            if to_date:
                params['to'] = to_date
            
            data = self._request("historical-price-eod/full", params)
            if data:
                return data
        except Exception as e:
            print(f"    Error fetching historical prices for {ticker}: {e}")
        return []
    
    def get_dividends(self, ticker: str) -> list:
        """Get dividend history"""
        try:
            data = self._request("dividends", {'symbol': ticker})
            if data:
                return data
        except Exception as e:
            print(f"    Error fetching dividends for {ticker}: {e}")
        return []


def find_price_on_date(prices: list, target_date: datetime, lookback_days: int = 7) -> Optional[float]:
    """Find the price on or before target_date."""
    target_str = target_date.strftime('%Y-%m-%d')
    min_date = (target_date - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    
    for price_data in prices:
        date_str = price_data.get('date', '')
        if min_date <= date_str <= target_str:
            return price_data.get('close')
    
    return None


def find_earliest_price(prices: list) -> tuple:
    """Find the earliest available price from the price history."""
    if not prices:
        return None, None
    
    # Prices are sorted newest first, so get the last one
    earliest = prices[-1]
    return earliest.get('close'), earliest.get('date')


def calculate_dividends_in_range(dividends: list, start_date: datetime, end_date: datetime) -> float:
    """Sum dividends between start_date and end_date (inclusive)"""
    total = 0.0
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    
    for div in dividends:
        div_date = div.get('date', '')
        if start_str <= div_date <= end_str:
            total += div.get('adjDividend', 0) or div.get('dividend', 0) or 0
    
    return total


def determine_canary_health(roc_percent: Optional[float]) -> str:
    """Determine canary health status based on ROC percentage"""
    if roc_percent is None:
        return "Unknown"
    if roc_percent >= 40:
        return "Dead"
    elif roc_percent >= 20:
        return "Dying"
    else:
        return "Healthy"


def calculate_death_clock(roc_percent: Optional[float]) -> Optional[float]:
    """Calculate years until half investment is gone from ROC"""
    if roc_percent is None or roc_percent <= 0:
        return None
    return round(50 / roc_percent, 2)


def estimate_roc_from_nav_erosion(
    price_at_inception: Optional[float],
    latest_price: Optional[float],
    total_dividends: float,
    years_since_inception: float,
    min_months: int = 3  # Reduced from 6 to capture more ETFs
) -> Optional[float]:
    """
    Estimate ROC percentage based on NAV erosion.
    
    Now uses 3-month minimum (down from 6) to capture newer ETFs.
    """
    if not price_at_inception or not latest_price:
        return None
    
    if years_since_inception < (min_months / 12):
        return None
    
    if total_dividends <= 0:
        return None
    
    price_change = latest_price - price_at_inception
    
    if price_change < 0:
        nav_erosion = abs(price_change)
        annual_nav_erosion = nav_erosion / years_since_inception
        annual_dividends = total_dividends / years_since_inception
        
        if annual_dividends > 0:
            roc_estimate = min((annual_nav_erosion / annual_dividends) * 100, 100)
            return round(roc_estimate, 2)
    
    return 0.0


def clear_database():
    """Clear all data from tables in correct order (respecting foreign keys)"""
    print("\n" + "="*60)
    print("STEP 1: Clearing database...")
    print("="*60)
    
    # Clear in correct order due to foreign key constraints
    # weekly_data and notices_19a1 reference etfs
    
    # Clear weekly_data (uses ticker_id FK)
    try:
        result = supabase.table('weekly_data').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        count = len(result.data) if result.data else 0
        print(f"  ✓ Cleared weekly_data: {count} rows deleted")
    except Exception as e:
        print(f"  ✗ Error clearing weekly_data: {e}")
    
    # Clear notices_19a1 (uses ticker_id FK)
    try:
        result = supabase.table('notices_19a1').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        count = len(result.data) if result.data else 0
        print(f"  ✓ Cleared notices_19a1: {count} rows deleted")
    except Exception as e:
        print(f"  ✗ Error clearing notices_19a1: {e}")
    
    # Clear etfs (main table)
    try:
        result = supabase.table('etfs').delete().neq('ticker', '').execute()
        count = len(result.data) if result.data else 0
        print(f"  ✓ Cleared etfs: {count} rows deleted")
    except Exception as e:
        print(f"  ✗ Error clearing etfs: {e}")


def insert_tickers(tickers: list):
    """Insert ticker placeholders into etfs table"""
    print("\n" + "="*60)
    print(f"STEP 2: Adding {len(tickers)} tickers to database...")
    print("="*60)
    
    success = 0
    failed = 0
    
    for ticker in tickers:
        try:
            # Insert minimal record - data will be populated in next step
            supabase.table('etfs').upsert({
                'ticker': ticker.upper().strip(),
                'name': ticker.upper().strip(),  # Placeholder, will be updated
                'canary_health': 'Unknown'
            }, on_conflict='ticker').execute()
            success += 1
        except Exception as e:
            print(f"  ✗ Failed to add {ticker}: {e}")
            failed += 1
    
    print(f"  ✓ Added {success} tickers")
    if failed > 0:
        print(f"  ✗ Failed: {failed} tickers")


def process_etf(ticker: str, fmp: FMPClient) -> dict:
    """Process a single ETF and return data for upsert."""
    today = datetime.now()
    one_year_ago = today - timedelta(days=365)
    ytd_start = datetime(today.year, 1, 1)
    
    # Get ETF profile and info
    profile = fmp.get_etf_profile(ticker)
    etf_info = fmp.get_etf_info(ticker)
    
    # Get historical prices (up to 5 years for inception price)
    five_years_ago = (today - timedelta(days=1825)).strftime('%Y-%m-%d')
    prices = fmp.get_historical_prices(ticker, from_date=five_years_ago)
    
    # Get dividends
    dividends = fmp.get_dividends(ticker)
    
    # Extract name
    name = None
    if etf_info:
        name = etf_info.get('name')
    if not name and profile:
        name = profile.get('companyName')
    if not name:
        name = ticker
    
    # Get inception date
    inception_date = None
    inception_str = None
    if etf_info and etf_info.get('inceptionDate'):
        inception_str = etf_info.get('inceptionDate')
    elif profile and profile.get('ipoDate'):
        inception_str = profile.get('ipoDate')
    
    if inception_str:
        try:
            if 'T' in inception_str:
                inception_date = datetime.strptime(inception_str.split('T')[0], '%Y-%m-%d')
            else:
                inception_date = datetime.strptime(inception_str, '%Y-%m-%d')
        except:
            pass
    
    # Get AUM and expense ratio
    aum = None
    expense_ratio = None
    if etf_info:
        aum = etf_info.get('assetsUnderManagement')
        expense_ratio = etf_info.get('expenseRatio')
    if not aum and profile:
        aum = profile.get('mktCap')
    
    if aum is not None:
        aum = int(round(aum))
    
    # Calculate prices
    latest_price = None
    latest_date = None
    if prices:
        latest_price = prices[0].get('close')
        latest_date = prices[0].get('date')
    
    price_1y_ago = find_price_on_date(prices, one_year_ago, lookback_days=7)
    
    ytd_start_date = datetime(today.year - 1, 12, 31)
    price_ytd_start = find_price_on_date(prices, ytd_start_date, lookback_days=7)
    if not price_ytd_start:
        price_ytd_start = find_price_on_date(prices, datetime(today.year, 1, 2), lookback_days=7)
    
    # Price at inception - try inception date first, then earliest available
    price_at_inception = None
    effective_inception_date = inception_date
    
    if inception_date:
        price_at_inception = find_price_on_date(prices, inception_date, lookback_days=14)
    
    # If no inception price, use earliest available price
    if not price_at_inception and prices:
        earliest_price, earliest_date = find_earliest_price(prices)
        if earliest_price:
            price_at_inception = earliest_price
            if earliest_date:
                try:
                    effective_inception_date = datetime.strptime(earliest_date, '%Y-%m-%d')
                except:
                    pass
    
    # Calculate dividends
    dividends_last_12mo = calculate_dividends_in_range(dividends, one_year_ago, today)
    dividends_ytd = calculate_dividends_in_range(dividends, ytd_start, today)
    dividends_since_inception = 0.0
    if effective_inception_date:
        dividends_since_inception = calculate_dividends_in_range(dividends, effective_inception_date, today)
    
    # Calculate headline yield
    headline_yield_ttm = None
    if latest_price and latest_price > 0:
        headline_yield_ttm = round(dividends_last_12mo / latest_price, 2)
    
    # Estimate ROC from NAV erosion
    roc_latest = None
    roc_date = None
    if effective_inception_date and price_at_inception:
        years_since_inception = (today - effective_inception_date).days / 365.0
        roc_latest = estimate_roc_from_nav_erosion(
            price_at_inception,
            latest_price,
            dividends_since_inception,
            years_since_inception,
            min_months=3  # 3 month minimum
        )
        if roc_latest is not None:
            roc_date = today.strftime('%Y-%m-%d')
    
    # Calculate derived metrics
    true_income_yield = None
    if headline_yield_ttm is not None and roc_latest is not None:
        true_income_yield = round(headline_yield_ttm * (1 - roc_latest / 100), 2)
    
    death_clock_years = calculate_death_clock(roc_latest)
    canary_health = determine_canary_health(roc_latest)
    
    # Calculate returns
    total_return_1y = None
    if latest_price and price_1y_ago and price_1y_ago > 0:
        total_return_1y = round((latest_price / price_1y_ago) - 1, 2)
    
    total_return_ytd = None
    if latest_price and price_ytd_start and price_ytd_start > 0:
        total_return_ytd = round((latest_price / price_ytd_start) - 1, 2)
    
    total_return_inception = None
    if latest_price and price_at_inception and price_at_inception > 0:
        total_return_inception = round((latest_price / price_at_inception) - 1, 2)
    
    spent_dividends_return_1y = None
    if latest_price and price_1y_ago and price_1y_ago > 0:
        spent_dividends_return_1y = round(
            ((latest_price - price_1y_ago) + dividends_last_12mo) / price_1y_ago, 2
        )
    
    spent_dividends_return_ytd = None
    if latest_price and price_ytd_start and price_ytd_start > 0:
        spent_dividends_return_ytd = round(
            ((latest_price - price_ytd_start) + dividends_ytd) / price_ytd_start, 2
        )
    
    spent_dividends_return_inception = None
    if latest_price and price_at_inception and price_at_inception > 0:
        spent_dividends_return_inception = round(
            ((latest_price - price_at_inception) + dividends_since_inception) / price_at_inception, 2
        )
    
    # Round values
    latest_price = round(latest_price, 2) if latest_price else None
    price_1y_ago = round(price_1y_ago, 2) if price_1y_ago else None
    price_ytd_start = round(price_ytd_start, 2) if price_ytd_start else None
    price_at_inception = round(price_at_inception, 2) if price_at_inception else None
    dividends_last_12mo = round(dividends_last_12mo, 2)
    dividends_ytd = round(dividends_ytd, 2)
    dividends_since_inception = round(dividends_since_inception, 2)
    expense_ratio = round(expense_ratio, 4) if expense_ratio else None
    
    return {
        'ticker': ticker,
        'name': name,
        'inception_date': inception_date.strftime('%Y-%m-%d') if inception_date else None,
        'aum': aum,
        'expense_ratio': expense_ratio,
        'roc_latest': roc_latest,
        'roc_date': roc_date,
        'canary_health': canary_health,
        'death_clock_years': death_clock_years,
        'headline_yield_ttm': headline_yield_ttm,
        'true_income_yield': true_income_yield,
        'latest_adj_close': latest_price,  # Schema uses latest_adj_close
        'latest_date': latest_date,         # Schema uses latest_date
        'price_1y_ago': price_1y_ago,
        'price_ytd_start': price_ytd_start,
        'price_at_inception': price_at_inception,
        'dividends_last_12mo': dividends_last_12mo,
        'dividends_ytd': dividends_ytd,
        'dividends_since_inception': dividends_since_inception,
        'total_return_1y': total_return_1y,
        'total_return_ytd': total_return_ytd,
        'total_return_inception': total_return_inception,
        'spent_dividends_return_1y': spent_dividends_return_1y,
        'spent_dividends_return_ytd': spent_dividends_return_ytd,
        'spent_dividends_return_inception': spent_dividends_return_inception,
        'updated_at': datetime.now().isoformat()
    }


def populate_etf_data(tickers: list, fmp: FMPClient):
    """Fetch and populate data for all tickers"""
    print("\n" + "="*60)
    print(f"STEP 3: Populating data for {len(tickers)} ETFs...")
    print("="*60)
    
    success = 0
    failed = 0
    health_counts = {'Healthy': 0, 'Dying': 0, 'Dead': 0, 'Unknown': 0}
    
    for i, ticker in enumerate(tickers, 1):
        print(f"\n[{i}/{len(tickers)}] Processing {ticker}...")
        
        try:
            etf_data = process_etf(ticker, fmp)
            
            # Upsert to database
            supabase.table('etfs').upsert(etf_data, on_conflict='ticker').execute()
            
            health = etf_data.get('canary_health', 'Unknown')
            health_counts[health] = health_counts.get(health, 0) + 1
            
            roc = etf_data.get('roc_latest')
            if roc is not None:
                print(f"    ✓ {ticker}: ROC={roc}%, Health={health}")
            else:
                print(f"    ○ {ticker}: No ROC data, Health={health}")
            
            success += 1
            
        except Exception as e:
            print(f"    ✗ Error processing {ticker}: {e}")
            failed += 1
    
    return success, failed, health_counts


def get_etf_id_map() -> dict:
    """Get mapping of ticker -> id from etfs table"""
    result = supabase.table('etfs').select('id, ticker').execute()
    return {row['ticker']: row['id'] for row in result.data} if result.data else {}


def populate_weekly_data(tickers: list, fmp: FMPClient):
    """Populate weekly_data table with historical prices and dividends"""
    print("\n" + "="*60)
    print(f"STEP 4: Populating weekly data for {len(tickers)} ETFs...")
    print("="*60)
    
    today = datetime.now()
    one_year_ago = (today - timedelta(days=365)).strftime('%Y-%m-%d')
    
    # Get ticker -> UUID mapping
    ticker_id_map = get_etf_id_map()
    
    success = 0
    total_records = 0
    
    for i, ticker in enumerate(tickers, 1):
        try:
            ticker_id = ticker_id_map.get(ticker)
            if not ticker_id:
                print(f"    Warning: No ID found for {ticker}, skipping weekly data")
                continue
            
            # Get prices and dividends
            prices = fmp.get_historical_prices(ticker, from_date=one_year_ago)
            dividends = fmp.get_dividends(ticker)
            
            # Create dividend lookup by date
            div_by_date = {d['date']: d.get('adjDividend', 0) or d.get('dividend', 0) for d in dividends}
            
            records = []
            for price in prices:
                date = price.get('date')
                close = price.get('close')
                if date and close is not None:
                    records.append({
                        'ticker_id': ticker_id,
                        'date': date,
                        'adj_close': round(close, 2),
                        'close_price': round(close, 2),
                        'dividend': round(div_by_date.get(date, 0), 4) if div_by_date.get(date, 0) else None
                    })
            
            # Batch insert
            if records:
                # Insert in batches of 100
                for j in range(0, len(records), 100):
                    batch = records[j:j+100]
                    supabase.table('weekly_data').upsert(
                        batch, 
                        on_conflict='ticker_id,date'
                    ).execute()
                
                total_records += len(records)
            
            success += 1
            if i % 20 == 0:
                print(f"    Progress: {i}/{len(tickers)} ETFs processed...")
                
        except Exception as e:
            print(f"    Warning: {ticker} weekly data error: {e}")
    
    print(f"  ✓ Weekly data: {success} ETFs, {total_records} total records")


def load_tickers_from_file(filepath: str) -> list:
    """Load tickers from a text file (one per line)"""
    tickers = []
    with open(filepath, 'r') as f:
        for line in f:
            ticker = line.strip().upper()
            if ticker and not ticker.startswith('#'):
                tickers.append(ticker)
    return tickers


def load_tickers_from_arg(arg: str) -> list:
    """Parse tickers from comma-separated argument"""
    return [t.strip().upper() for t in arg.split(',') if t.strip()]


def print_summary(success: int, failed: int, health_counts: dict, total_tickers: int):
    """Print final summary"""
    print("\n" + "="*60)
    print("BOOTSTRAP COMPLETE")
    print("="*60)
    print(f"\nTotal tickers: {total_tickers}")
    print(f"Successfully processed: {success}")
    print(f"Failed: {failed}")
    print(f"\nCanary Health Summary:")
    print(f"  🟢 Healthy (ROC < 20%):  {health_counts.get('Healthy', 0)}")
    print(f"  🟡 Dying (ROC 20-40%):   {health_counts.get('Dying', 0)}")
    print(f"  🔴 Dead (ROC >= 40%):    {health_counts.get('Dead', 0)}")
    print(f"  ⚪ Unknown (no ROC):     {health_counts.get('Unknown', 0)}")


def main():
    """Main bootstrap function"""
    print("\n" + "="*60)
    print("YieldCanary Database Bootstrap")
    print("="*60)
    
    # Use the DEFAULT_TICKERS list defined at the top of this file
    # Client: Add/remove tickers from DEFAULT_TICKERS list above
    tickers = DEFAULT_TICKERS
    
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        
        if arg.endswith('.txt'):
            # Load from file
            print(f"Loading tickers from file: {arg}")
            tickers = load_tickers_from_file(arg)
        elif ',' in arg:
            # Comma-separated list
            print(f"Using provided tickers")
            tickers = load_tickers_from_arg(arg)
        else:
            # Single ticker
            tickers = [arg.upper().strip()]
    
    # Remove duplicates while preserving order
    seen = set()
    unique_tickers = []
    for t in tickers:
        if t not in seen:
            seen.add(t)
            unique_tickers.append(t)
    tickers = unique_tickers
    
    print(f"\nTickers to process: {len(tickers)}")
    print(f"Sample: {', '.join(tickers[:10])}...")
    
    # Initialize FMP client
    fmp = FMPClient(FMP_API_KEY)
    
    # Step 1: Clear database
    clear_database()
    
    # Step 2: Insert tickers
    insert_tickers(tickers)
    
    # Step 3: Populate ETF data (with ROC estimation)
    success, failed, health_counts = populate_etf_data(tickers, fmp)
    
    
    # Step 4: Populate weekly data
    populate_weekly_data(tickers, fmp)
    
    # Print summary
    print_summary(success, failed, health_counts, len(tickers))


if __name__ == "__main__":
    main()
