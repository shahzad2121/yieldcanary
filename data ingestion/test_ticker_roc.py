"""
TSLY ROC Calculation Test
=========================

Calculates Return of Capital (ROC) for TSLY using split detection logic.
Uses the same approach as bootstrap_database.py: detect splits, adjust prices,
then estimate ROC from NAV erosion.
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


def fetch_prices(ticker: str, from_date: str) -> list:
    """Fetch unadjusted historical prices from FMP."""
    url = f"{BASE_URL}/historical-price-eod/full"
    params = {'symbol': ticker, 'from': from_date, 'apikey': FMP_API_KEY}
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()


def fetch_dividends(ticker: str) -> list:
    """Fetch dividend history from FMP."""
    url = f"{BASE_URL}/dividends"
    params = {'symbol': ticker, 'apikey': FMP_API_KEY}
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()


def fetch_etf_info(ticker: str) -> Optional[dict]:
    """Fetch ETF info (inception date, etc.) from FMP."""
    url = f"{BASE_URL}/etf/info"
    params = {'symbol': ticker, 'apikey': FMP_API_KEY}
    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()
    return data[0] if data else None


def find_price_on_date(prices: list, target_date: datetime, lookback_days: int = 7) -> Optional[float]:
    """Find the price on or before target_date. Prices sorted newest first."""
    target_str = target_date.strftime('%Y-%m-%d')
    min_date = (target_date - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    for price_data in prices:
        date_str = price_data.get('date', '')
        if min_date <= date_str <= target_str:
            return price_data.get('close')
    return None


def find_earliest_price(prices: list) -> tuple:
    """Find the earliest available price. Returns (price, date)."""
    if not prices:
        return None, None
    earliest = prices[-1]
    return earliest.get('close'), earliest.get('date')


def calculate_dividends_in_range(dividends: list, start_date: datetime, end_date: datetime) -> float:
    """Sum dividends between start_date and end_date (inclusive)."""
    total = 0.0
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    for div in dividends:
        div_date = div.get('date', '')
        if start_str <= div_date <= end_str:
            total += div.get('adjDividend', 0) or div.get('dividend', 0) or 0
    return total


def estimate_roc_from_nav_erosion(
    price_at_inception: Optional[float],
    latest_price: Optional[float],
    total_dividends: float,
    years_since_inception: float,
    min_months: int = 3
) -> Optional[float]:
    """
    Estimate ROC % from NAV erosion. Same logic as bootstrap_database.py.
    """
    if not price_at_inception or not latest_price:
        return None
    if years_since_inception < (min_months / 12):
        return 0.0
    if total_dividends <= 0:
        return 0.0

    price_change = latest_price - price_at_inception

    if price_change < 0:
        nav_erosion = abs(price_change)
        annual_nav_erosion = nav_erosion / years_since_inception
        annual_dividends = total_dividends / years_since_inception
        if annual_dividends > 0:
            return round(min((annual_nav_erosion / annual_dividends) * 100, 100), 2)
    else:
        annual_price_gain = price_change / years_since_inception
        annual_dividends = total_dividends / years_since_inception
        if annual_dividends > annual_price_gain:
            shortfall = annual_dividends - annual_price_gain
            return round(min((shortfall / annual_dividends) * 100, 100), 2)

    return 0.0


def determine_canary_health(roc_percent: Optional[float]) -> str:
    """Map ROC to health status."""
    if roc_percent is None:
        return "Unknown"
    if roc_percent >= 40:
        return "Dead"
    if roc_percent >= 20:
        return "Dying"
    return "Healthy"


def main():
    ticker = 'XYZY'

    print("\n" + "=" * 70)
    print(f"TSLY ROC CALCULATION (using split detection logic)")
    print("=" * 70)

    today = datetime.now()
    five_years_ago = (today - timedelta(days=1825)).strftime('%Y-%m-%d')

    # Fetch data
    print(f"\n📥 Fetching data for {ticker}...")
    prices = fetch_prices(ticker, five_years_ago)
    dividends = fetch_dividends(ticker)
    etf_info = fetch_etf_info(ticker)

    if not prices:
        print(f"  ❌ No price data for {ticker}")
        return

    print(f"  ✅ {len(prices)} price rows, {len(dividends)} dividend records")

    # Detect splits and adjust prices
    print(f"\n🔍 Detecting splits...")
    splits = detect_splits(prices, threshold=1.5)
    if splits:
        for split in splits:
            print(f"  ⚠️  {split['type'].upper()} split on {split['date']}: "
                  f"${split['prev_price']:.2f} → ${split['curr_price']:.2f} ({split['ratio']:.2f}:1)")
        prices = adjust_prices_for_splits(prices, splits)
        print(f"  ✅ Applied split adjustments")
    else:
        print(f"  ✓ No splits detected")

    # Inception date
    inception_date = None
    inception_str = etf_info.get('inceptionDate') if etf_info else None
    if inception_str:
        try:
            inception_date = datetime.strptime(inception_str.split('T')[0], '%Y-%m-%d')
        except Exception:
            pass

    # Price at inception
    price_at_inception = None
    effective_inception_date = inception_date
    if inception_date:
        price_at_inception = find_price_on_date(prices, inception_date, lookback_days=14)
    if not price_at_inception:
        price_at_inception, earliest_date = find_earliest_price(prices)
        if earliest_date:
            try:
                effective_inception_date = datetime.strptime(earliest_date, '%Y-%m-%d')
            except Exception:
                pass

    # Latest price
    latest_price = prices[0].get('close') if prices else None
    latest_date = prices[0].get('date') if prices else None

    # Dividends since inception
    dividends_since_inception = 0.0
    if effective_inception_date:
        dividends_since_inception = calculate_dividends_in_range(dividends, effective_inception_date, today)

    # Years since inception
    years_since_inception = (today - effective_inception_date).days / 365.0 if effective_inception_date else 0.0

    # Calculate ROC
    roc_latest = estimate_roc_from_nav_erosion(
        price_at_inception,
        latest_price,
        dividends_since_inception,
        years_since_inception,
        min_months=3
    )

    # Results
    print(f"\n📊 ROC CALCULATION RESULTS")
    print(f"=" * 70)
    print(f"  Ticker:              {ticker}")
    print(f"  Latest price:        ${latest_price:.2f} on {latest_date}")
    print(f"  Price at inception:  ${price_at_inception:.2f}" if price_at_inception else "  Price at inception:  N/A")
    print(f"  Inception date:      {effective_inception_date.strftime('%Y-%m-%d')}" if effective_inception_date else "  Inception date:      N/A")
    print(f"  Years since inception: {years_since_inception:.2f}")
    print(f"  Dividends since inception: ${dividends_since_inception:.2f}")
    print(f"\n  ROC (estimated):     {roc_latest}%" if roc_latest is not None else "  ROC (estimated):     N/A")
    print(f"  Canary Health:       {determine_canary_health(roc_latest)}")
    print(f"\n" + "=" * 70 + "\n")


if __name__ == "__main__":
    main()
