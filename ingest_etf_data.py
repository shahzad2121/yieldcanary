"""
YieldCanary ETF Data Ingestion Script
Pulls data from FMP API and populates Supabase tables:
- etfs (master table)
- weekly_data (historical prices/dividends)
- notices_19a1 (ROC data - separate process)
"""

import os
import sys
import requests
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables (supports both local .env.local and GitHub Actions secrets)
load_dotenv('.env.local')

# Configuration - works with both local dev and GitHub Actions
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

# ETF Ticker List from project spec
ETF_TICKERS = [
    # Fully Unlocked for Free Users (Top 4) – appear only here
    "TSLY", "QYLD", "XYLD", "MSTY",

    # YieldMax ETFs (all option-income single-stock + basket funds)
    "NVDY", "CONY", "AMZY", "APLY", "FBY", "MSFO", "GOOY", "TSMY", "PLTY", "MRNY",
    "AIYY", "YMAX", "YMAG", "ULTY", "LFGY", "GPTY", "SDTY", "QDTY", "RDTY", "CHPY",
    "YBIT", "YETH", "MSTW", "BABO", "ABNY", "AMDY", "BIGY", "BRKC", "CRCO", "CRSH",
    "CVNY", "DIPS", "DISO", "DRAY", "FEAT", "FIAT", "FIVY", "GDXY", "GMEY", "HIYY",
    "HOOY", "JPMO", "MARO", "MSST", "NFLY", "NVIT", "OARK", "PYPY", "RBLY", "RDYY",
    "RNTY", "SLTY", "SMCY", "SNOY", "SOXY", "WNTR", "XOMO", "XYZY", "YQQQ",

    # Roundhill Investments ETFs (high-yield / option-income)
    "QDTE", "XDTE", "RDTE", "YBTC", "ARMY", "ASMY", "AVGY", "BABY", "COSTY", "CRWDY",
    "MAGS", "CHAT", "WPAY", "HOOW", "METV", "PLTW", "MAGY", "TSLW", "WEEK", "NVDW",
    "COIW", "MAGX", "XPAY", "GOOW", "AVGW", "AMDW", "METW", "AAPW", "OZEM", "AMZW",
    "BRKW", "MSFW", "HUMN", "NFLW", "ARMW", "UBEW", "BABW", "COSW", "NERD", "MAGC",
    "XDIV", "MEME", "GDXW", "GLDW", "WEED", "TSYW", "UX", "UNHW",

    # Defiance ETFs (high-yield / option-income)
    "JEDI", "TRIL", "YBMN", "QLDY", "SPYT", "GLDY", "USOY", "QQQY", "IWMY", "WDTE",
    "QTUM", "SIXG", "AIPO", "XMAG", "MSTX", "ORCX", "SMCX", "OKLL", "HIMZ", "IONX",
    "IRE", "AVGX", "NVOX", "SOFX", "RKLX", "RGTX", "LLYX", "SOUX", "RIOX", "HOOX",
    "QPUX", "QSU", "MPL", "DKNX", "OSCX", "ANEL", "VSTL", "CVNX", "LMNX", "JPX",
    "AVXX", "XPM", "BU", "RGTZ", "PLTZ", "IONZ", "SMST", "QBTZ", "SMCZ", "VIXI",
    "LLYZ", "BMNZ", "HOOZ", "DAMD", "STSM", "RKLZ", "OKLS", "QQYI", "MST", "QQQT",
    "HIMY", "AMDU", "ETHI", "HOOI", "PLT", "SMCC",

    # NEOS ETFs (high-yield option-income)
    "SPYI", "QQQI", "IWMI", "BTCI", "IYRI", "QQQH", "SPYH", "NEHI", "IAUI", "HYBI",
    "BNDI", "CSHI", "TLTI", "NIHI", "NLSI",

    # REX Shares ETFs (high-yield / leveraged option-income)
    "NVII", "TSII", "COII", "MSII", "AIPI", "FEPI", "DRNZ", "ARM", "ARMU", "DJTU",
    "RBLU", "GMEU", "SNOU", "SMUP", "BULU", "SOLX", "AFRU", "AXUP", "KTUP",

    # Kurv ETFs (yield-premium / option-income)
    "KYLD", "KQQQ", "KGLD", "KSLV", "AMZP", "AAPY", "GOOP", "MSFY", "NFLP", "TSLP",

    # ZEGA ETFs
    "ZHDG",

    # JPMorgan Equity Premium Income
    "JEPI", "JEPQ",

    # Global X covered-call classics (added the rest of the family)
    "RYLD", "DJD", "QYLG", "XYLG", "RYLG"
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
            print(f"Error fetching profile for {ticker}: {e}")
        return None
    
    def get_etf_info(self, ticker: str) -> Optional[dict]:
        """Get ETF-specific info (inception date, expense ratio)"""
        try:
            data = self._request("etf-info", {'symbol': ticker})
            if data and len(data) > 0:
                return data[0]
        except Exception as e:
            print(f"Error fetching ETF info for {ticker}: {e}")
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
            print(f"Error fetching historical prices for {ticker}: {e}")
        return []
    
    def get_dividends(self, ticker: str) -> list:
        """Get dividend history"""
        try:
            data = self._request("dividends", {'symbol': ticker})
            if data:
                return data
        except Exception as e:
            print(f"Error fetching dividends for {ticker}: {e}")
        return []


def find_price_on_date(prices: list, target_date: datetime, lookback_days: int = 7) -> Optional[float]:
    """
    Find the price on or before target_date.
    Looks back up to lookback_days to find closest trading day.
    prices should be sorted by date descending (newest first).
    """
    target_str = target_date.strftime('%Y-%m-%d')
    min_date = (target_date - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    
    for price_data in prices:
        date_str = price_data.get('date', '')
        if min_date <= date_str <= target_str:
            # Stable API uses 'close' field
            return price_data.get('close')
    
    return None


def calculate_dividends_in_range(dividends: list, start_date: datetime, end_date: datetime) -> float:
    """Sum dividends between start_date and end_date (inclusive)"""
    total = 0.0
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    
    for div in dividends:
        div_date = div.get('date', '')
        if start_str <= div_date <= end_str:
            # Stable API uses 'adjDividend' as the adjusted dividend amount
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
        return None  # Infinity - healthy
    return round(50 / roc_percent, 2)


def process_etf(ticker: str, fmp: FMPClient, tax_rate: float = 0.0) -> dict:
    """
    Process a single ETF and return data for upsert.
    tax_rate is for take-home calculations (default 0 for ETF-level, user-specific elsewhere)
    """
    print(f"Processing {ticker}...")
    
    today = datetime.now()
    one_year_ago = today - timedelta(days=365)
    ytd_start = datetime(today.year, 1, 1)
    
    # Get ETF profile
    profile = fmp.get_etf_profile(ticker)
    
    # Get historical prices (last 2 years to cover inception for newer ETFs)
    two_years_ago = (today - timedelta(days=730)).strftime('%Y-%m-%d')
    prices = fmp.get_historical_prices(ticker, from_date=two_years_ago)
    
    # Get dividends
    dividends = fmp.get_dividends(ticker)
    
    # Extract basic info
    name = profile.get('companyName', ticker) if profile else ticker
    
    # Try to get inception date from profile or ETF info
    inception_date = None
    if profile and profile.get('ipoDate'):
        try:
            inception_date = datetime.strptime(profile['ipoDate'], '%Y-%m-%d')
        except:
            pass
    
    # Get AUM and expense ratio
    aum = profile.get('mktCap') if profile else None  # Market cap as proxy for AUM
    expense_ratio = None  # FMP may not have this, might need alternative source
    
    # Calculate prices
    latest_price = None
    latest_date = None
    if prices:
        latest_price = prices[0].get('close')
        latest_date = prices[0].get('date')
    
    # Price 1 year ago (rolling 365 days)
    price_1y_ago = find_price_on_date(prices, one_year_ago, lookback_days=7)
    
    # Price YTD start (last trading day of prior year or first of this year)
    ytd_start_date = datetime(today.year - 1, 12, 31)
    price_ytd_start = find_price_on_date(prices, ytd_start_date, lookback_days=7)
    if not price_ytd_start:
        price_ytd_start = find_price_on_date(prices, datetime(today.year, 1, 2), lookback_days=7)
    
    # Price at inception
    price_at_inception = None
    if inception_date:
        price_at_inception = find_price_on_date(prices, inception_date, lookback_days=14)
    
    # Calculate dividends
    dividends_last_12mo = calculate_dividends_in_range(dividends, one_year_ago, today)
    dividends_ytd = calculate_dividends_in_range(dividends, ytd_start, today)
    dividends_since_inception = 0.0
    if inception_date:
        dividends_since_inception = calculate_dividends_in_range(dividends, inception_date, today)
    
    # Calculate headline yield TTM
    headline_yield_ttm = None
    if latest_price and latest_price > 0:
        headline_yield_ttm = round(dividends_last_12mo / latest_price, 4)
    
    # Fetch existing ROC data from database (preserve manually entered data)
    roc_latest = None
    roc_date = None
    try:
        existing = supabase.table('etfs').select('roc_latest, roc_date').eq('ticker', ticker).execute()
        if existing.data and len(existing.data) > 0:
            roc_latest = existing.data[0].get('roc_latest')
            roc_date = existing.data[0].get('roc_date')
    except:
        pass
    
    # True income yield = Headline Yield × (1 - ROC%/100)
    # ROC is stored as percentage (e.g., 15 = 15%, not 0.15)
    true_income_yield = None
    if headline_yield_ttm is not None and roc_latest is not None:
        true_income_yield = round(headline_yield_ttm * (1 - roc_latest / 100), 4)
    
    # Death clock and canary health - ROC is already stored as percentage
    death_clock_years = calculate_death_clock(roc_latest)
    canary_health = determine_canary_health(roc_latest)
    
    # Calculate returns (1Y, YTD, Inception)
    # Total Return = (Latest / Price at period start) - 1
    total_return_1y = None
    if latest_price and price_1y_ago and price_1y_ago > 0:
        total_return_1y = round((latest_price / price_1y_ago) - 1, 4)
    
    total_return_ytd = None
    if latest_price and price_ytd_start and price_ytd_start > 0:
        total_return_ytd = round((latest_price / price_ytd_start) - 1, 4)
    
    total_return_inception = None
    if latest_price and price_at_inception and price_at_inception > 0:
        total_return_inception = round((latest_price / price_at_inception) - 1, 4)
    
    # Spent-Dividends Return = ((Latest - Start) + Dividends) / Start
    spent_dividends_return_1y = None
    if latest_price and price_1y_ago and price_1y_ago > 0:
        spent_dividends_return_1y = round(
            ((latest_price - price_1y_ago) + dividends_last_12mo) / price_1y_ago, 4
        )
    
    spent_dividends_return_ytd = None
    if latest_price and price_ytd_start and price_ytd_start > 0:
        spent_dividends_return_ytd = round(
            ((latest_price - price_ytd_start) + dividends_ytd) / price_ytd_start, 4
        )
    
    spent_dividends_return_inception = None
    if latest_price and price_at_inception and price_at_inception > 0:
        spent_dividends_return_inception = round(
            ((latest_price - price_at_inception) + dividends_since_inception) / price_at_inception, 4
        )
    
    # Take-Home Return (after-tax reinvested)
    # = ((Latest × (1 - tax)) + (Dividends × (1 - tax))) / Start - 1
    tax_mult = 1 - tax_rate / 100
    
    take_home_return_1y = None
    if latest_price and price_1y_ago and price_1y_ago > 0:
        take_home_return_1y = round(
            ((latest_price * tax_mult) + (dividends_last_12mo * tax_mult)) / price_1y_ago - 1, 4
        )
    
    take_home_return_ytd = None
    if latest_price and price_ytd_start and price_ytd_start > 0:
        take_home_return_ytd = round(
            ((latest_price * tax_mult) + (dividends_ytd * tax_mult)) / price_ytd_start - 1, 4
        )
    
    take_home_return_inception = None
    if latest_price and price_at_inception and price_at_inception > 0:
        take_home_return_inception = round(
            ((latest_price * tax_mult) + (dividends_since_inception * tax_mult)) / price_at_inception - 1, 4
        )
    
    # Take-Home Cash Return (after-tax, dividends spent not reinvested)
    # = ((Latest - Start) + (Dividends × (1 - tax))) / Start
    take_home_cash_return_1y = None
    if latest_price and price_1y_ago and price_1y_ago > 0:
        take_home_cash_return_1y = round(
            ((latest_price - price_1y_ago) + (dividends_last_12mo * tax_mult)) / price_1y_ago, 4
        )
    
    take_home_cash_return_ytd = None
    if latest_price and price_ytd_start and price_ytd_start > 0:
        take_home_cash_return_ytd = round(
            ((latest_price - price_ytd_start) + (dividends_ytd * tax_mult)) / price_ytd_start, 4
        )
    
    take_home_cash_return_inception = None
    if latest_price and price_at_inception and price_at_inception > 0:
        take_home_cash_return_inception = round(
            ((latest_price - price_at_inception) + (dividends_since_inception * tax_mult)) / price_at_inception, 4
        )
    
    return {
        'ticker': ticker,
        'name': name,
        'inception_date': inception_date.strftime('%Y-%m-%d') if inception_date else None,
        'aum': aum,
        'expense_ratio': expense_ratio,
        'roc_latest': roc_latest,
        'roc_date': roc_date,
        'canary_health': canary_health,
        'latest_date': latest_date,
        'latest_adj_close': latest_price,
        'dividends_last_12mo': dividends_last_12mo,
        'dividends_ytd': dividends_ytd,
        'dividends_since_inception': dividends_since_inception,
        'price_1y_ago': price_1y_ago,
        'price_ytd_start': price_ytd_start,
        'price_at_inception': price_at_inception,
        'headline_yield_ttm': headline_yield_ttm,
        'true_income_yield': true_income_yield,
        'death_clock_years': death_clock_years,
        'total_return_1y': total_return_1y,
        'spent_dividends_return_1y': spent_dividends_return_1y,
        'take_home_return_1y': take_home_return_1y,
        'take_home_cash_return_1y': take_home_cash_return_1y,
        'total_return_ytd': total_return_ytd,
        'spent_dividends_return_ytd': spent_dividends_return_ytd,
        'take_home_return_ytd': take_home_return_ytd,
        'take_home_cash_return_ytd': take_home_cash_return_ytd,
        'total_return_inception': total_return_inception,
        'spent_dividends_return_inception': spent_dividends_return_inception,
        'take_home_return_inception': take_home_return_inception,
        'take_home_cash_return_inception': take_home_cash_return_inception,
        'updated_at': datetime.now().isoformat()
    }


def upsert_etf(data: dict) -> bool:
    """Upsert ETF data to Supabase"""
    try:
        # Remove None values for cleaner upsert
        clean_data = {k: v for k, v in data.items() if v is not None}
        
        result = supabase.table('etfs').upsert(
            clean_data,
            on_conflict='ticker'
        ).execute()
        
        return True
    except Exception as e:
        print(f"Error upserting {data.get('ticker')}: {e}")
        return False


def ingest_weekly_data(ticker: str, ticker_id: str, fmp: FMPClient) -> int:
    """
    Ingest weekly price and dividend data for an ETF.
    Returns count of records inserted.
    """
    print(f"  Ingesting weekly data for {ticker}...")
    
    # Get last 2 years of data
    today = datetime.now()
    two_years_ago = (today - timedelta(days=730)).strftime('%Y-%m-%d')
    
    prices = fmp.get_historical_prices(ticker, from_date=two_years_ago)
    dividends = fmp.get_dividends(ticker)
    
    # Create dividend lookup by date
    div_lookup = {d.get('date'): d.get('adjDividend', 0) or d.get('dividend', 0) for d in dividends}
    
    # Prepare weekly data records
    records = []
    for price in prices:
        date_str = price.get('date')
        adj_close = price.get('close')
        dividend = div_lookup.get(date_str, 0)
        
        if date_str and adj_close:
            records.append({
                'date': date_str,
                'ticker_id': ticker_id,
                'adj_close': adj_close,
                'dividend': dividend
            })
    
    # Batch upsert to weekly_data
    if records:
        try:
            # Upsert in batches of 100
            batch_size = 100
            for i in range(0, len(records), batch_size):
                batch = records[i:i+batch_size]
                supabase.table('weekly_data').upsert(
                    batch,
                    on_conflict='date,ticker_id'
                ).execute()
            print(f"    Inserted {len(records)} weekly records for {ticker}")
            return len(records)
        except Exception as e:
            print(f"    Error inserting weekly data for {ticker}: {e}")
    
    return 0


def get_etf_id(ticker: str) -> Optional[str]:
    """Get the UUID for an ETF by ticker"""
    try:
        result = supabase.table('etfs').select('id').eq('ticker', ticker).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]['id']
    except Exception as e:
        print(f"Error getting ID for {ticker}: {e}")
    return None


def update_roc_from_notices(ticker_id: str) -> tuple:
    """
    Fetch the latest ROC data from notices_19a1 table and return (roc_percent, notice_date)
    """
    try:
        result = supabase.table('notices_19a1')\
            .select('roc_percent, notice_date')\
            .eq('ticker_id', ticker_id)\
            .order('notice_date', desc=True)\
            .limit(1)\
            .execute()
        
        if result.data and len(result.data) > 0:
            return (result.data[0]['roc_percent'], result.data[0]['notice_date'])
    except Exception as e:
        print(f"Error fetching ROC for ticker_id {ticker_id}: {e}")
    
    return (None, None)


def recalculate_etf_with_roc(ticker: str, ticker_id: str) -> bool:
    """
    After fetching ROC data, recalculate dependent fields and update ETF record.
    """
    roc_latest, roc_date = update_roc_from_notices(ticker_id)
    
    if roc_latest is None:
        return False
    
    # Get current ETF data
    result = supabase.table('etfs').select('*').eq('ticker', ticker).execute()
    if not result.data:
        return False
    
    etf = result.data[0]
    
    # Recalculate ROC-dependent fields
    headline_yield_ttm = etf.get('headline_yield_ttm')
    
    true_income_yield = None
    if headline_yield_ttm is not None:
        true_income_yield = round(headline_yield_ttm * (1 - roc_latest / 100), 4)
    
    death_clock_years = calculate_death_clock(roc_latest)
    canary_health = determine_canary_health(roc_latest)
    
    # Update ETF record
    update_data = {
        'roc_latest': roc_latest,
        'roc_date': roc_date,
        'true_income_yield': true_income_yield,
        'death_clock_years': death_clock_years,
        'canary_health': canary_health,
        'updated_at': datetime.now().isoformat()
    }
    
    try:
        supabase.table('etfs').update(update_data).eq('ticker', ticker).execute()
        print(f"  Updated ROC data for {ticker}: {roc_latest}% ({canary_health})")
        return True
    except Exception as e:
        print(f"Error updating ROC for {ticker}: {e}")
        return False


def run_full_ingestion(tickers: list = None, include_weekly: bool = False):
    """
    Run full data ingestion for all ETFs.
    
    Args:
        tickers: Optional list of tickers to process. If None, uses ETF_TICKERS.
        include_weekly: If True, also populates weekly_data table.
    """
    if tickers is None:
        tickers = ETF_TICKERS
    
    fmp = FMPClient(FMP_API_KEY)
    
    print(f"Starting ingestion for {len(tickers)} ETFs...")
    print("=" * 50)
    
    success_count = 0
    error_count = 0
    
    for ticker in tickers:
        try:
            # Process ETF data
            etf_data = process_etf(ticker, fmp)
            
            # Upsert to database
            if upsert_etf(etf_data):
                success_count += 1
                
                # Optionally ingest weekly data
                if include_weekly:
                    ticker_id = get_etf_id(ticker)
                    if ticker_id:
                        ingest_weekly_data(ticker, ticker_id, fmp)
                
                # Update ROC from notices_19a1 if available
                ticker_id = get_etf_id(ticker)
                if ticker_id:
                    recalculate_etf_with_roc(ticker, ticker_id)
            else:
                error_count += 1
                
        except Exception as e:
            print(f"Error processing {ticker}: {e}")
            error_count += 1
    
    print("=" * 50)
    print(f"Ingestion complete: {success_count} success, {error_count} errors")
    
    # Exit with error code if there were failures (for GitHub Actions)
    if error_count > 0 and success_count == 0:
        sys.exit(1)


def run_weekly_update():
    """
    Weekly update - refresh prices and recalculate all fields.
    This should run every Monday.
    """
    run_full_ingestion(include_weekly=True)


def run_roc_update():
    """
    Update ROC data from notices_19a1 table for all ETFs.
    Run this after manually updating 19a-1 notices.
    """
    print("Updating ROC data from notices_19a1...")
    
    # Get all ETFs
    result = supabase.table('etfs').select('id, ticker').execute()
    
    for etf in result.data:
        recalculate_etf_with_roc(etf['ticker'], etf['id'])
    
    print("ROC update complete.")


if __name__ == "__main__":
    print(f"[START] YieldCanary Data Ingestion - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Database: {SUPABASE_URL}")
    print("=" * 50)
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "full":
            run_full_ingestion(include_weekly=True)
        elif command == "etfs":
            run_full_ingestion(include_weekly=False)
        elif command == "roc":
            run_roc_update()
        elif command == "weekly":
            run_weekly_update()
        elif command == "single" and len(sys.argv) > 2:
            ticker = sys.argv[2].upper()
            run_full_ingestion(tickers=[ticker], include_weekly=True)
        else:
            print("Usage:")
            print("  python ingest_etf_data.py full    - Full ingestion with weekly data")
            print("  python ingest_etf_data.py etfs    - ETFs table only (faster)")
            print("  python ingest_etf_data.py roc     - Update ROC from notices_19a1")
            print("  python ingest_etf_data.py weekly  - Weekly refresh")
            print("  python ingest_etf_data.py single TICKER - Single ETF")
    else:
        # Default: run ETF ingestion only
        run_full_ingestion(include_weekly=False)
