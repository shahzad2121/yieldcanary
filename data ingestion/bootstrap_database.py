def display_take_home_returns_for_all_users(etf_data):

    print("[INFO] Take-home return and take-home cash return fields are now calculated in the frontend using the user's tax rate. This function is deprecated.")


import os
import sys
import time
import traceback
import requests
from datetime import datetime, timedelta
from typing import Optional
from collections import Counter
from dotenv import load_dotenv
from supabase import create_client, Client

from split_detection import detect_splits, adjust_prices_for_splits

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
    "ABNY", "AIYY", "AMDY", "AMZY", "APLY", "BABO", "BIGY", "BRKC", "CHPY", "CONY",
    "CRCO", "CRSH", "CVNY", "DIPS", "DISO", "DRAY", "FBY", "FEAT", "FIAT", "FIVY",
    "GDXY", "GMEY", "GOOY", "GPTY", "HIYY", "HOOY", "JPMO", "LFGY", "MARO", "MRNY",
    "MSFO", "MSST", "MSTY", "NFLY", "NVDY", "NVIT", "OARK", "PLTY", "PYPY", "QDTY",
    "RBLY", "RDTY", "RDYY", "RNTY", "SDTY", "SLTY", "SMCY", "SNOY", "SOXY", "TEST",
    "TSLY", "TSMY", "ULTY", "WNTR", "XOMO", "XYZY", "YBIT", "YMAG", "YMAX", "YQQQ",
    
    # Defiance ETFs
    "YBMN", "QLDY", "SPYT", "GLDY", "USOY", "QQQY", "IWMY", "WDTE",
    "QQQT", "MST", "JEPY",
    
    # Roundhill ETFs  
    "XDTE", "QDTE", "RDTE", "XPAY", "YBTC", "YETH", "MAGY",
    "AAPW", "AMDW", "ARMW", "AMZW", "AVGW", "BABW", "BRKW",
    "COIW", "COSW", "GDXW", "GLDW", "GOOW", "HOOW", "METW",
    "MSFW", "MSTW", "NFLW", "NVDW", "PLTW", "TSLW", "TSYW",
    "UBEW", "UNHW", "WPAY",
    
    # REX Shares ETFs
    "FEPI", "AIPI", "CEPI", "COII", "MSII", "NVII", "TSII",
    "HOII", "PLTI", "CWII", "LLII", "WMTI", "ULTI",
    
    # Kurv ETFs
    "KYLD", "KQQQ", "KGLD", "KSLV", "AMZP", "AAPY", "GOOP", "MSFY", "NFLP", "TSLP",
    
    # First Trust / Global X / Other
    "JEPI", "JEPQ", "XYLD", "QYLD", "RYLD", "SDIV",
    
    # Neos ETFs
    "SPYI", "QQQI", "IWMI", "NIHI", "IYRI", "IAUI", "BTCI", "NEHI",
    
    # Amplify / Simplify
    "YYY", "SVOL", "HIGH", "BUCK", "MAXI", "QDVO",

    # ProShares High Income ETFs
    "ISPY", "IQQQ", "ITWO", "EETH","BITO",

    # Goldman Sachs ETFs (premium income)
    "GPIX", "GPIQ",

    # TappAlpha ETFs (daily covered call income)
    "TDAQ", "TSPY", "TSYX",

    # Tuttle Capital ETFs
    "MAGO", "MSTK", "BITK",

    # Westwood Holdings ETFs
    "MDST",

    # Calamos Investments ETFs
    "CAIE",

    # GraniteShares YieldBOOST ETFs (high-yield weekly option income)
    "AMYY", "AZYY", "BBYY", "XBTY", "COYY", "NUGY", "HMYY", "HOYY",
    "IOYY", "MAAY", "FBYY", "MTYY", "NVYY", "PLYY", "QBY", "TQQY",
    "RGYY", "RTYY", "SEMY", "YBST", "SMYY", "YSPY", "YBTY", "TSYY",

    # VistaShares Target 15™ ETFs (options income, high yield)
    "OMAH", "QUSA", "ACKY", "DRKY", "SIOO",

    # Strategy B
    "STRC",

    # PIMCO High-Yield Income ETFs
    "PDI", "PTY", "PDO",

    # Nicholas Wealth XFunds
    "FIAX", "GIAX", "BLOX",
]


class FMPClient:
    """Financial Modeling Prep API Client - Using Stable API endpoints"""
    
    BASE_URL = "https://financialmodelingprep.com/stable"
    
    # Rate limiting settings
    REQUESTS_PER_MINUTE = 300  # FMP free tier is 250-300/min, adjust as needed
    MIN_REQUEST_INTERVAL = 60.0 / REQUESTS_PER_MINUTE  # Minimum seconds between requests
    MAX_RETRIES = 5
    INITIAL_BACKOFF = 2.0  # Initial backoff in seconds
    MAX_BACKOFF = 60.0  # Maximum backoff in seconds
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._last_request_time = 0.0
    
    def _wait_for_rate_limit(self):
        """Enforce minimum interval between requests"""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.MIN_REQUEST_INTERVAL:
            sleep_time = self.MIN_REQUEST_INTERVAL - elapsed
            time.sleep(sleep_time)
        self._last_request_time = time.time()
    
    def _request(self, endpoint: str, params: dict = None) -> list:
        """Make API request with rate limiting, error handling, and exponential backoff"""
        if params is None:
            params = {}
        params['apikey'] = self.api_key
        
        url = f"{self.BASE_URL}/{endpoint}"
        
        for attempt in range(self.MAX_RETRIES):
            self._wait_for_rate_limit()
            
            try:
                response = requests.get(url, params=params)
                
                # Handle rate limiting (429 Too Many Requests)
                if response.status_code == 429:
                    backoff = min(self.INITIAL_BACKOFF * (2 ** attempt), self.MAX_BACKOFF)
                    print(f"    Rate limited (429). Waiting {backoff:.1f}s before retry {attempt + 1}/{self.MAX_RETRIES}...")
                    time.sleep(backoff)
                    continue
                
                response.raise_for_status()
                return response.json()
                
            except requests.exceptions.HTTPError as e:
                if response.status_code == 429:
                    # Already handled above, but just in case
                    backoff = min(self.INITIAL_BACKOFF * (2 ** attempt), self.MAX_BACKOFF)
                    print(f"    Rate limited. Waiting {backoff:.1f}s before retry {attempt + 1}/{self.MAX_RETRIES}...")
                    time.sleep(backoff)
                    continue
                else:
                    raise
            except requests.exceptions.RequestException as e:
                if attempt < self.MAX_RETRIES - 1:
                    backoff = min(self.INITIAL_BACKOFF * (2 ** attempt), self.MAX_BACKOFF)
                    print(f"    Request error: {e}. Waiting {backoff:.1f}s before retry {attempt + 1}/{self.MAX_RETRIES}...")
                    time.sleep(backoff)
                    continue
                else:
                    raise
        
        # If we've exhausted all retries
        raise requests.exceptions.HTTPError(f"Failed after {self.MAX_RETRIES} retries")
    
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


def clamp_numeric(value: Optional[float], max_val: float = 9999.9999, min_val: float = -9999.9999) -> Optional[float]:
    """Clamp numeric values to fit database NUMERIC(10,6) constraints for percentage values.
    
    Database columns with precision 10, scale 6 can store up to 9999.999999.
    Default clamp allows yields/returns from -9999.9999% to 9999.9999% (e.g. 10%, 20%, 50%).
    Rejects only absurd values; keeps defense against bad data.
    """
    if value is None:
        return None
    return max(min_val, min(max_val, value))


def estimate_roc_from_nav_erosion(
    price_at_inception: Optional[float],
    latest_price: Optional[float],
    total_dividends: float,
    years_since_inception: float,
    min_months: int = 3
) -> Optional[float]:
    """
    Estimate ROC percentage based on NAV erosion.

    Now uses 3-month minimum (down from 6) to capture more ETFs.

    Returns:
        - 0.0% if too new (< 3 months) - assume healthy until proven otherwise
        - 0.0% if no NAV erosion (price increased and fully funded)
        - 0.0% if no dividends (no distributions = no ROC)
        - Calculated % if NAV erosion detected
        - None only if data is missing/invalid

    Key changes from original:
        - Returns 0.0 instead of None for new ETFs (eliminates "Unknown" status)
        - Returns 0.0 instead of None for no-dividend ETFs
        - Handles "underfunded distributions" (price up but < dividends paid)
    """
    # Data validation - can't calculate without prices
    if not price_at_inception or not latest_price:
        return None

    # Too new → Default to 0% (assume healthy until proven otherwise)
    if years_since_inception < (min_months / 12):
        return 0.0  # Changed from None to eliminate "Unknown" status

    # No dividends → 0% ROC (no distributions = no return of capital)
    if total_dividends <= 0:
        return 0.0  # Changed from None

    price_change = latest_price - price_at_inception

    # Case 1: Price declined (NAV erosion)
    if price_change < 0:
        nav_erosion = abs(price_change)
        annual_nav_erosion = nav_erosion / years_since_inception
        annual_dividends = total_dividends / years_since_inception

        if annual_dividends > 0:
            roc_estimate = min((annual_nav_erosion / annual_dividends) * 100, 100)
            return round(roc_estimate, 2)

    # Case 2: Price increased
    else:
        # Check if distributions exceeded price gains (underfunded)
        # Example: Price +$8, Dividends $26 → $18 came from ROC
        annual_price_gain = price_change / years_since_inception
        annual_dividends = total_dividends / years_since_inception

        if annual_dividends > annual_price_gain:
            # Distributions partially funded by ROC
            shortfall = annual_dividends - annual_price_gain
            roc_estimate = min((shortfall / annual_dividends) * 100, 100)
            return round(roc_estimate, 2)

    # Case 3: Fully funded by gains (no ROC)
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


def validate_etf_data(ticker: str, profile: Optional[dict], etf_info: Optional[dict], prices: list) -> tuple:
    """
    Validate that FMP has sufficient data for this ETF.

    Returns invalid tickers that should be skipped:
    - No inception date (can't calculate ROC or returns)
    - No price history (can't calculate anything)
    - No basic profile data (ticker doesn't exist in FMP)

    Args:
        ticker: ETF ticker symbol
        profile: FMP profile data
        etf_info: FMP ETF info data
        prices: List of historical prices

    Returns:
        (is_valid: bool, skip_reason: str or None)
    """
    # Check inception date
    has_inception = False
    if etf_info and etf_info.get('inceptionDate'):
        has_inception = True
    elif profile and profile.get('ipoDate'):
        has_inception = True

    if not has_inception:
        return False, "No inception date"

    # Check price history
    if not prices or len(prices) == 0:
        return False, "No price history"

    # Check for at least some basic data
    if not profile and not etf_info:
        return False, "No profile data"

    # Valid ETF
    return True, None


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

    # Validate ETF data - skip if insufficient
    is_valid, skip_reason = validate_etf_data(ticker, profile, etf_info, prices)
    if not is_valid:
        print(f"    ⊗ {ticker}: {skip_reason} - SKIPPING")
        return None  # Signal to skip this ETF

    # Detect and correct stock splits
    splits = detect_splits(prices, threshold=1.5)
    if splits:
        print(f"    ⚠️  {ticker}: Detected {len(splits)} split(s)")
        for split in splits:
            split_type = split['type'].upper()
            ratio = split['ratio']
            date = split['date']
            print(f"       {split_type} split on {date} ({ratio:.2f}:1)")

        # Apply split corrections to all prices
        prices = adjust_prices_for_splits(prices, splits)
        print(f"    ✅ {ticker}: Applied split adjustments")

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
        # FMP returns expenseRatio already as percentage (e.g., 0.0945 = 0.0945%, 0.99 = 0.99%)
        # Store as-is - no conversion needed
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
    
    # Calculate headline yield (multiply by 100 to store as percentage)
    headline_yield_ttm = None
    if latest_price and latest_price > 0:
        headline_yield_ttm = round((dividends_last_12mo / latest_price) * 100, 2)
    
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
    
    # Calculate derived metrics (headline_yield_ttm is now percentage, roc_latest is percentage)
    true_income_yield = None
    if headline_yield_ttm is not None and roc_latest is not None:
        true_income_yield = round(headline_yield_ttm * (1 - roc_latest / 100), 2)
    
    death_clock_years = calculate_death_clock(roc_latest)
    canary_health = determine_canary_health(roc_latest)
    
    # Calculate returns (multiply by 100 to store as percentage)
    total_return_1y = None
    if latest_price and price_1y_ago and price_1y_ago > 0:
        total_return_1y = round(((latest_price / price_1y_ago) - 1) * 100, 2)
    
    total_return_ytd = None
    if latest_price and price_ytd_start and price_ytd_start > 0:
        total_return_ytd = round(((latest_price / price_ytd_start) - 1) * 100, 2)
    
    total_return_inception = None
    if latest_price and price_at_inception and price_at_inception > 0:
        total_return_inception = round(((latest_price / price_at_inception) - 1) * 100, 2)
    
    # Calculate spent dividends returns (multiply by 100 to store as percentage)
    spent_dividends_return_1y = None
    if latest_price and price_1y_ago and price_1y_ago > 0:
        spent_dividends_return_1y = round(
            (((latest_price - price_1y_ago) + dividends_last_12mo) / price_1y_ago) * 100, 2
        )
    
    spent_dividends_return_ytd = None
    if latest_price and price_ytd_start and price_ytd_start > 0:
        spent_dividends_return_ytd = round(
            (((latest_price - price_ytd_start) + dividends_ytd) / price_ytd_start) * 100, 2
        )
    
    spent_dividends_return_inception = None
    if latest_price and price_at_inception and price_at_inception > 0:
        spent_dividends_return_inception = round(
            (((latest_price - price_at_inception) + dividends_since_inception) / price_at_inception) * 100, 2
        )
    

    # Take-Home Return and Take-Home Cash Return fields are not calculated here; frontend will handle tax-rate-dependent calculations
    take_home_return_1y = None
    take_home_return_ytd = None
    take_home_return_inception = None
    take_home_cash_return_1y = None
    take_home_cash_return_ytd = None
    take_home_cash_return_inception = None

    # Round values
    latest_price = round(latest_price, 2) if latest_price else None
    price_1y_ago = round(price_1y_ago, 2) if price_1y_ago else None
    price_ytd_start = round(price_ytd_start, 2) if price_ytd_start else None
    price_at_inception = round(price_at_inception, 2) if price_at_inception else None
    dividends_last_12mo = round(dividends_last_12mo, 2)
    dividends_ytd = round(dividends_ytd, 2)
    dividends_since_inception = round(dividends_since_inception, 2)
    expense_ratio = round(expense_ratio, 2) if expense_ratio else None  # Already converted to percentage
    
    # Clamp values to fit NUMERIC(5,4) database constraints (-9.9999 to 9.9999)
    # This handles extreme yields/returns from high-yield ETFs
    headline_yield_ttm = clamp_numeric(headline_yield_ttm)
    true_income_yield = clamp_numeric(true_income_yield)
    total_return_1y = clamp_numeric(total_return_1y)
    total_return_ytd = clamp_numeric(total_return_ytd)
    total_return_inception = clamp_numeric(total_return_inception)
    spent_dividends_return_1y = clamp_numeric(spent_dividends_return_1y)
    spent_dividends_return_ytd = clamp_numeric(spent_dividends_return_ytd)
    spent_dividends_return_inception = clamp_numeric(spent_dividends_return_inception)
    
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
        # Take-Home fields - user-specific, computed in frontend with user's tax rate
        'take_home_return_1y': take_home_return_1y,
        'take_home_return_ytd': take_home_return_ytd,
        'take_home_return_inception': take_home_return_inception,
        'take_home_cash_return_1y': take_home_cash_return_1y,
        'take_home_cash_return_ytd': take_home_cash_return_ytd,
        'take_home_cash_return_inception': take_home_cash_return_inception,
        'updated_at': datetime.now().isoformat()
    }


def populate_etf_data(tickers: list, fmp: FMPClient):
    """Fetch and populate data for all tickers"""
    print("\n" + "="*60)
    print(f"STEP 3: Populating data for {len(tickers)} ETFs...")
    print("="*60)

    success = 0
    failed = 0
    skipped_tickers = []
    health_counts = {'Healthy': 0, 'Dying': 0, 'Dead': 0, 'Unknown': 0}

    for i, ticker in enumerate(tickers, 1):
        print(f"\n[{i}/{len(tickers)}] Processing {ticker}...")

        try:
            etf_data = process_etf(ticker, fmp)

            # Skip if validation failed
            if etf_data is None:
                skipped_tickers.append(ticker)
                failed += 1
                continue

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

    # Show which tickers were skipped
    if skipped_tickers:
        print(f"\n{'='*60}")
        print(f"⚠️  SKIPPED TICKERS ({len(skipped_tickers)} total)")
        print(f"{'='*60}")
        print("These tickers were skipped due to insufficient FMP data:")
        for t in skipped_tickers[:25]:
            print(f"  • {t}")
        if len(skipped_tickers) > 25:
            print(f"  ... and {len(skipped_tickers) - 25} more")
        print(f"\nTip: Remove these from DEFAULT_TICKERS list to clean up")

    return success, failed, health_counts


def get_etf_id_map() -> dict:
    """Get mapping of ticker -> id from etfs table"""
    result = supabase.table('etfs').select('id, ticker').execute()
    return {row['ticker']: row['id'] for row in result.data} if result.data else {}


def populate_notices_19a1(tickers: list):
    """Populate notices_19a1 table with ROC data from etfs table.
    
    Per project.txt Table 3: 19a-1 Notices (ROC) schema:
    - ticker_id: Link to ETFs
    - roc_percent: ROC % (latest value)
    - notice_date: Date of the notice
    """
    print("\n" + "="*60)
    print(f"STEP 4: Populating 19a-1 notices for {len(tickers)} ETFs...")
    print("="*60)
    
    today = datetime.now()
    
    # Get ticker -> UUID mapping
    ticker_id_map = get_etf_id_map()
    
    # Get ROC data from etfs table
    result = supabase.table('etfs').select('ticker, roc_latest, roc_date').execute()
    
    success = 0
    skipped = 0
    
    for row in result.data or []:
        ticker = row.get('ticker')
        roc_latest = row.get('roc_latest')
        roc_date = row.get('roc_date')
        
        if ticker not in ticker_id_map:
            continue
        
        # Only insert if we have ROC data
        if roc_latest is not None:
            try:
                notice_record = {
                    'ticker_id': ticker_id_map[ticker],
                    'roc_percent': roc_latest,
                    'notice_date': roc_date or today.strftime('%Y-%m-%d'),
                    'effective_date': roc_date or today.strftime('%Y-%m-%d')
                }
                
                # Use insert instead of upsert (table is cleared at bootstrap start)
                supabase.table('notices_19a1').insert(notice_record).execute()
                success += 1
                
            except Exception as e:
                print(f"    Warning: {ticker} notice error: {e}")
        else:
            skipped += 1
    
    print(f"  ✓ 19a-1 notices: {success} records inserted, {skipped} ETFs skipped (no ROC data)")


def populate_weekly_data(tickers: list, fmp: FMPClient):
    """Populate weekly_data table with historical prices and dividends"""
    print("\n" + "="*60)
    print(f"STEP 5: Populating weekly data for {len(tickers)} ETFs...")
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


def determine_payout_frequency(weekly_rows: list[dict]) -> Optional[str]:
    """
    Determines payout frequency based on spacing between dividend weeks.
    weekly_rows = rows for ONE ETF from weekly_data table
    Returns: 'Weekly', 'Monthly', 'Quarterly', or None
    """
    # 1. Extract weeks with actual payouts
    payout_dates = sorted(
        [
            datetime.fromisoformat(row["date"])
            for row in weekly_rows
            if row.get("dividend") not in (None, "", 0, "0", "0.0", 0.0)
        ]
    )

    # Not enough data to determine behavior
    if len(payout_dates) < 3:
        return None

    # 2. Calculate gaps in weeks between payouts
    week_gaps = []
    for i in range(1, len(payout_dates)):
        delta_weeks = (payout_dates[i] - payout_dates[i - 1]).days // 7
        if delta_weeks > 0:
            week_gaps.append(delta_weeks)

    if not week_gaps:
        return None

    # 3. Find most common spacing
    most_common_gap, _ = Counter(week_gaps).most_common(1)[0]

    # 4. Classify frequency
    if most_common_gap <= 2:
        return "Weekly"
    elif 3 <= most_common_gap <= 6:
        return "Monthly"
    elif 10 <= most_common_gap <= 14:
        return "Quarterly"
    else:
        return None


def populate_payout_frequencies():
    """
    Calculate and update payout_frequency for all ETFs based on weekly_data.
    Runs AFTER populate_weekly_data() has completed.
    """
    print("\n" + "="*60)
    print("STEP 6: Calculating payout frequencies...")
    print("="*60)

    # Get ticker -> UUID mapping
    ticker_id_map = get_etf_id_map()
    
    today = datetime.now()
    one_year_ago = today - timedelta(days=365)
    
    updated = 0
    skipped = 0
    
    for ticker, ticker_id in ticker_id_map.items():
        try:
            # Fetch weekly_data for this ETF (last year)
            result = (
                supabase
                .table('weekly_data')
                .select('date, dividend')
                .eq('ticker_id', ticker_id)
                .gte('date', one_year_ago.strftime('%Y-%m-%d'))
                .order('date', desc=False)
                .execute()
            )
            
            weekly_rows = result.data or []
            
            if not weekly_rows:
                skipped += 1
                continue
            
            # Determine frequency
            payout_frequency = determine_payout_frequency(weekly_rows)
            
            # Update ETF record
            supabase.table('etfs').update({
                'payout_frequency': payout_frequency
            }).eq('id', ticker_id).execute()
            
            updated += 1
            if updated % 50 == 0:
                print(f"    Progress: {updated} ETFs updated...")
                
        except Exception as e:
            print(f"    Warning: Failed to calculate frequency for {ticker}: {e}")
            skipped += 1
    
    print(f"  ✓ Payout frequency updated for {updated} ETFs")
    if skipped > 0:
        print(f"  ○ Skipped {skipped} ETFs (insufficient data)")


def populate_last_month_distributions():
    """
    Calculate and update last_month_distribution for all ETFs based on weekly_data.
    
    This calculates the most recent complete calendar month's total distribution.
    For example, if today is January 15, it calculates December's total.
    """
    print("\n" + "="*60)
    print("STEP 7: Calculating last month distributions...")
    print("="*60)

    # Get ticker -> UUID mapping
    ticker_id_map = get_etf_id_map()
    
    today = datetime.now()
    
    # Find the most recent complete calendar month
    # If today is Jan 15, most recent complete month is December
    if today.day == 1:
        # If today is the 1st, use the month before last
        last_month_start = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        last_month_end = today.replace(day=1) - timedelta(days=1)
    else:
        # Otherwise, use last month
        last_month_start = today.replace(day=1) - timedelta(days=1)
        last_month_start = last_month_start.replace(day=1)
        last_month_end = today.replace(day=1) - timedelta(days=1)
    
    start_str = last_month_start.strftime('%Y-%m-%d')
    end_str = last_month_end.strftime('%Y-%m-%d')
    
    updated = 0
    skipped = 0
    
    for ticker, ticker_id in ticker_id_map.items():
        try:
            # Fetch weekly_data for this ETF for the last complete month
            result = (
                supabase
                .table('weekly_data')
                .select('date, dividend')
                .eq('ticker_id', ticker_id)
                .gte('date', start_str)
                .lte('date', end_str)
                .order('date', desc=False)
                .execute()
            )
            
            weekly_rows = result.data or []
            
            if not weekly_rows:
                skipped += 1
                continue
            
            # Sum all dividends in that month
            total_distribution = 0.0
            for row in weekly_rows:
                div = row.get('dividend')
                if div is not None and div != 0:
                    total_distribution += float(div)
            
            # Update ETF record
            if total_distribution > 0:
                supabase.table('etfs').update({
                    'last_month_distribution': round(total_distribution, 4)
                }).eq('id', ticker_id).execute()
                updated += 1
            else:
                # Set to None if no distributions
                supabase.table('etfs').update({
                    'last_month_distribution': None
                }).eq('id', ticker_id).execute()
                skipped += 1
                
            if updated % 50 == 0:
                print(f"    Progress: {updated} ETFs updated...")
                
        except Exception as e:
            print(f"    Warning: Failed to calculate last month distribution for {ticker}: {e}")
            skipped += 1
    
    print(f"  ✓ Last month distribution updated for {updated} ETFs")
    if skipped > 0:
        print(f"  ○ Skipped {skipped} ETFs (no distribution data for last month)")


def recalculate_headline_yield_from_weekly_data():
    """
    Recalculate headline_yield_ttm for all ETFs using the weekly_data table.
    
    Formula (per client):
      Headline Yield = SUM(dividends last 365 days) / latest adjusted price
    
    This step runs after weekly_data has been populated so it uses the
    canonical dividend history stored in Supabase rather than the raw
    FMP API response used earlier in process_etf().
    """
    print("\n" + "="*60)
    print("STEP 7: Recalculating Headline Yield (TTM) from weekly_data...")
    print("="*60)

    today = datetime.now().date()
    one_year_ago = today - timedelta(days=365)
    start_str = one_year_ago.strftime('%Y-%m-%d')
    end_str = today.strftime('%Y-%m-%d')

    # Get mapping of ticker -> id once
    ticker_id_map = get_etf_id_map()

    if not ticker_id_map:
        print("  ✗ No ETFs found in database, skipping headline yield recalculation.")
        return

    updated = 0
    skipped = 0

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
                continue

            # Latest price is the adj_close from the most recent row
            latest_row = rows[0]
            latest_price = latest_row.get('adj_close')

            if not latest_price or latest_price <= 0:
                skipped += 1
                continue

            # Sum all non-null dividends in the period
            total_dividends = 0.0
            for row in rows:
                div = row.get('dividend')
                if div is not None:
                    total_dividends += float(div)

            # If there were no dividends, keep existing headline_yield_ttm
            if total_dividends <= 0:
                skipped += 1
                continue

            # Multiply by 100 to store as percentage
            headline_yield_ttm = round((total_dividends / float(latest_price)) * 100, 6)
            headline_yield_ttm = clamp_numeric(headline_yield_ttm)

            supabase.table('etfs').update(
                {'headline_yield_ttm': headline_yield_ttm}
            ).eq('id', ticker_id).execute()

            updated += 1
        except Exception as e:
            print(f"    Warning: Failed to recalc headline yield for {ticker}: {e}")
            skipped += 1

    print(f"  ✓ Headline yield updated for {updated} ETFs")
    if skipped:
        print(f"  ○ Skipped {skipped} ETFs (no dividends or price data)")


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
    print(f"\nTotal tickers attempted: {total_tickers}")
    print(f"Successfully processed: {success}")
    print(f"Failed/Skipped: {failed}")
    print(f"\nCanary Health Summary:")
    print(f"  🟢 Healthy (ROC < 20%):  {health_counts.get('Healthy', 0)}")
    print(f"  🟡 Dying (ROC 20-40%):   {health_counts.get('Dying', 0)}")
    print(f"  🔴 Dead (ROC >= 40%):    {health_counts.get('Dead', 0)}")
    print(f"  ⚪ Unknown (no ROC):     {health_counts.get('Unknown', 0)}")
    print(f"\nETFs stored in database: {success}")
    if failed > 0:
        print(f"⚠️  {failed} tickers were skipped (see log above)")


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
    
    # Set bootstrap flag to prevent cron jobs from running during bootstrap
    print("\n" + "="*60)
    print("Setting bootstrap flag (prevents cron updates during rebuild)...")
    print("="*60)
    try:
        supabase.table('system_flags').upsert({
            'key': 'bootstrap_running',
            'value': True,
            'updated_at': datetime.now().isoformat()
        }, on_conflict='key').execute()
        print("  ✓ Bootstrap flag set")
    except Exception as e:
        print(f"  ⚠ Warning: Failed to set bootstrap flag: {e}")
        print("  Continuing anyway (cron jobs may run during bootstrap)")
    
    # Initialize FMP client
    fmp = FMPClient(FMP_API_KEY)
    
    # Wrap ALL bootstrap steps in try/finally to guarantee flag is cleared
    # This ensures cron jobs always resume, even if bootstrap fails
    try:
        # Step 1: Clear database
        clear_database()
        
        # Step 2: Insert tickers
        insert_tickers(tickers)
        
        # Step 3: Populate ETF data (with ROC estimation)
        success, failed, health_counts = populate_etf_data(tickers, fmp)
        
        # Step 4: Populate 19a-1 notices (ROC data)
        populate_notices_19a1(tickers)

        # Step 5: Populate weekly data
        populate_weekly_data(tickers, fmp)

        # Step 5b: Recalculate 90-day average price from weekly_data (for Buy Zone filter)
        from recalc_price_avg_90d import recalculate_price_avg_90d
        recalculate_price_avg_90d()

        # Step 6: Calculate payout frequencies
        populate_payout_frequencies()
        
        # Step 7: Calculate last month distributions
        populate_last_month_distributions()
        
        # Step 8: Recalculate headline yield from weekly_data so it uses
        # the canonical dividend history stored in Supabase.
        recalculate_headline_yield_from_weekly_data()

        # Step 9: Recalculate advertised_yield (last payout × annualization / price).
        # Requires payout_frequency (Step 6) and weekly_data (Step 5). NULL when insufficient data.
        from recalc_advertised_yield import recalculate_advertised_yield
        recalculate_advertised_yield()

        # Print summary (only if everything succeeded)
        print_summary(success, failed, health_counts, len(tickers))
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Bootstrap interrupted by user (Ctrl+C)")
        raise  # Re-raise to ensure finally block runs
    except Exception as e:
        print(f"\n\n❌ Bootstrap failed with error: {e}")
        traceback.print_exc()
        raise  # Re-raise to ensure finally block runs
    finally:
        # ALWAYS clear bootstrap flag, no matter what happens
        # This is critical - if flag isn't cleared, cron jobs will never run again
        print("\n" + "="*60)
        print("Clearing bootstrap flag (cron jobs can resume)...")
        print("="*60)
        try:
            supabase.table('system_flags').upsert({
                'key': 'bootstrap_running',
                'value': False,
                'updated_at': datetime.now().isoformat()
            }, on_conflict='key').execute()
            print("  ✓ Bootstrap flag cleared")
        except Exception as e:
            print(f"  ❌ CRITICAL: Failed to clear bootstrap flag: {e}")
            print("  ⚠️  Manual reset REQUIRED:")
            print("     UPDATE system_flags SET value = false WHERE key = 'bootstrap_running';")
            # Still raise the exception so user knows something went wrong
            raise


if __name__ == "__main__":
    main()
