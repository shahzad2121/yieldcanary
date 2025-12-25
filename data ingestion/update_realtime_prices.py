"""
Real-Time Price Update Script (2-Minute Polling)
=================================================
Updates latest prices for all ETFs using FMP quote endpoint.
This script runs every 2 minutes during market hours.

Only updates:
- latest_adj_close (current real-time price)
- latest_date (date of the price)

Does NOT update:
- Dividends
- ROC calculations
- Other metrics (handled by weekly script)

Usage:
    python update_realtime_prices.py
"""

import os
import sys
import time
import requests
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
# Try parent directory first (where .env.local usually is)
load_dotenv('../.env.local')
# Fallback to current directory
if not os.getenv('FMP_API_KEY'):
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


class FMPClient:
    """Financial Modeling Prep API Client - For Real-Time Quotes"""
    
    BASE_URL = "https://financialmodelingprep.com/stable"
    
    # Rate limiting settings
    REQUESTS_PER_MINUTE = 300
    MIN_REQUEST_INTERVAL = 60.0 / REQUESTS_PER_MINUTE
    MAX_RETRIES = 5
    INITIAL_BACKOFF = 2.0
    MAX_BACKOFF = 60.0
    
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
                response = requests.get(url, params=params, timeout=10)
                
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
        
        raise requests.exceptions.HTTPError(f"Failed after {self.MAX_RETRIES} retries")
    
    def get_realtime_quote(self, ticker: str) -> Optional[dict]:
        """Get real-time quote for a ticker using quote endpoint"""
        try:
            # Use quote endpoint for real-time prices
            # Format: /stable/quote?symbol={ticker}&apikey={key}
            params = {
                'symbol': ticker
            }
            data = self._request("quote", params)
            
            # Quote endpoint returns array with one item
            if data and len(data) > 0:
                quote = data[0]
                price = quote.get('price')
                
                if price:
                    # Use current date for real-time quotes
                    return {
                        'price': price,
                        'date': datetime.now().strftime('%Y-%m-%d')
                    }
        except Exception as e:
            print(f"    Error fetching quote for {ticker}: {e}")
        return None


def get_all_tickers() -> list:
    """Get all tickers from the database"""
    try:
        result = supabase.table('etfs').select('ticker').execute()
        if result.data:
            return [row['ticker'] for row in result.data]
        return []
    except Exception as e:
        print(f"Error fetching tickers: {e}")
        return []


def get_test_tickers() -> list:
    """Get test tickers - 20 famous ETFs for testing"""
    return [
        "TSLY", "JEPI", "QYLD", "SPYI", "NVDY",  # High-yield income
        "SPY", "QQQ", "IWM", "DIA", "VTI",       # Major market ETFs
        "SCHD", "VYM", "DVY", "HDV", "DIVO",    # Dividend ETFs
        "XYLD", "RYLD", "JEPQ", "SVOL", "BITO"  # More income ETFs
    ]


def update_etf_price(ticker: str, price: float, price_date: str) -> bool:
    """Update the latest price for an ETF in the database"""
    try:
        # Round price to 2 decimal places
        rounded_price = round(price, 2)
        
        supabase.table('etfs').update({
            'latest_adj_close': rounded_price,
            'latest_date': price_date,
            'updated_at': datetime.now().isoformat()
        }).eq('ticker', ticker).execute()
        
        return True
    except Exception as e:
        print(f"    Error updating {ticker}: {e}")
        return False


def main():
    """Main function to update all ETF prices"""
    print("\n" + "="*60)
    print("Real-Time Price Update (2-Minute Polling)")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Initialize FMP client
    fmp = FMPClient(FMP_API_KEY)
    
    # Get all tickers from database
    print("Fetching tickers from database...")
    tickers = get_all_tickers()
    
    if not tickers:
        print("  ✗ No tickers found in database")
        return
    
    print(f"  ✓ Found {len(tickers)} ETFs to update\n")
    
    # Update prices
    success = 0
    failed = 0
    skipped = 0
    
    for i, ticker in enumerate(tickers, 1):
        print(f"[{i}/{len(tickers)}] Processing {ticker}...", end=" ")
        
        try:
            # Get real-time quote from FMP
            quote_data = fmp.get_realtime_quote(ticker)
            
            if not quote_data or not quote_data.get('price'):
                print("✗ No quote data")
                skipped += 1
                continue
            
            price = quote_data['price']
            price_date = quote_data['date']
            
            # Update in database
            if update_etf_price(ticker, price, price_date):
                print(f"✓ Updated: ${price:.2f} ({price_date})")
                success += 1
            else:
                print("✗ Update failed")
                failed += 1
                
        except Exception as e:
            print(f"✗ Error: {e}")
            failed += 1
    
    # Summary
    print("\n" + "="*60)
    print("UPDATE COMPLETE")
    print("="*60)
    print(f"Successfully updated: {success}")
    print(f"Failed: {failed}")
    print(f"Skipped (no data): {skipped}")
    print(f"Total: {len(tickers)}")
    print(f"\nFinished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")


if __name__ == "__main__":
    main()

