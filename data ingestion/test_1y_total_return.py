"""
1Y Total Return Calculation Test
================================

Calculates 1-year price total return for a list of ETFs using split detection logic.
Uses split-adjusted prices so returns are correct for ETFs that had splits (e.g., XYZY).
"""

import os
import requests
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

from split_detection import detect_splits, adjust_prices_for_splits

load_dotenv('.env.local')

FMP_API_KEY = os.getenv('FMP_API_KEY')
BASE_URL = "https://financialmodelingprep.com/stable"

# Default tickers to test
TICKERS = ["CONY", "FIAT", "AIYY", "DIPS", "CRSH", "OARK",  "ABNY"]


def fetch_prices(ticker: str, from_date: str) -> list:
    """Fetch unadjusted historical prices from FMP."""
    url = f"{BASE_URL}/historical-price-eod/full"
    params = {'symbol': ticker, 'from': from_date, 'apikey': FMP_API_KEY}
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()


def find_price_on_date(prices: list, target_date: datetime, lookback_days: int = 7) -> tuple:
    """Find the price and date on or before target_date. Returns (price, date_str)."""
    target_str = target_date.strftime('%Y-%m-%d')
    min_date = (target_date - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    for price_data in prices:
        date_str = price_data.get('date', '')
        if min_date <= date_str <= target_str:
            return price_data.get('close'), date_str
    return None, None


def calculate_1y_total_return(ticker: str) -> Optional[float]:
    """
    Calculate 1-year total return (price only) for a ticker.
    Uses split detection and adjustment so returns are correct.
    Returns percentage (e.g., -67.35 for -67.35%).
    """
    today = datetime.now()
    one_year_ago = today - timedelta(days=365)
    from_date = (today - timedelta(days=400)).strftime('%Y-%m-%d')

    prices = fetch_prices(ticker, from_date)
    if not prices:
        return None

    # Detect splits and adjust prices
    splits = detect_splits(prices, threshold=1.5)
    if splits:
        prices = adjust_prices_for_splits(prices, splits)

    # Latest price (first in list, newest first)
    latest_price = prices[0].get('close') if prices else None
    latest_date = prices[0].get('date') if prices else None

    # Price 1 year ago
    price_1y_ago, date_1y_ago = find_price_on_date(prices, one_year_ago, lookback_days=7)

    if not latest_price or not price_1y_ago or price_1y_ago <= 0:
        return None

    total_return_pct = ((latest_price / price_1y_ago) - 1) * 100
    return round(total_return_pct, 2)


def run_test(tickers: list):
    """Calculate and print 1Y total return for each ticker in the list."""
    print("\n" + "=" * 70)
    print("1Y TOTAL RETURN (split-adjusted)")
    print("=" * 70)
    print(f"\nTickers: {tickers}")

    for ticker in tickers:
        try:
            total_return = calculate_1y_total_return(ticker)
            if total_return is not None:
                sign = "+" if total_return >= 0 else ""
                print(f"\n  {ticker}: {sign}{total_return}%")
            else:
                print(f"\n  {ticker}: N/A (no data)")
        except Exception as e:
            print(f"\n  {ticker}: Error - {e}")

    print("\n" + "=" * 70 + "\n")


def main():
    run_test(TICKERS)


if __name__ == "__main__":
    main()
