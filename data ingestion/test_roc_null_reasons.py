"""
Test ROC calculation locally – no database reads or writes.

Add ETF ticker(s), fetch data from FMP only, run enhanced ROC logic, and print
why ROC is null or the computed value. Use this to debug ROC nulls in isolation.

Usage:
  python "data ingestion/test_roc_null_reasons.py"              # run default tickers
  python "data ingestion/test_roc_null_reasons.py" QBY NVDY    # run for QBY, NVDY

Requires: .env.local with FMP_API_KEY (project root)
"""

import os
import sys
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple

# Load .env.local from project root
_script_dir = Path(__file__).resolve().parent
_project_root = _script_dir.parent
_env_path = _project_root / ".env.local"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path)
else:
    try:
        from dotenv import load_dotenv
        load_dotenv(".env.local")
    except Exception:
        pass

import requests

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
FMP_API_KEY = os.getenv("FMP_API_KEY")
BASE_URL = "https://financialmodelingprep.com/stable"

# Tickers to test when no args (edit this list to add ETFs)
DEFAULT_TICKERS = ["QBY", "NVDY", "TSLY", "XYZY"]

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# Minimal FMP client (read-only, no DB)
# -----------------------------------------------------------------------------
class FMPClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._last_request = 0.0
        self._min_interval = 60.0 / 300

    def _wait(self):
        elapsed = time.time() - self._last_request
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_request = time.time()

    def _request(self, endpoint: str, params: dict = None):
        if params is None:
            params = {}
        params["apikey"] = self.api_key
        url = f"{BASE_URL}/{endpoint}"
        self._wait()
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and data.get("Error Message"):
            raise RuntimeError(data["Error Message"])
        return data

    def get_etf_profile(self, ticker: str) -> Optional[dict]:
        try:
            data = self._request("profile", {"symbol": ticker})
            return data[0] if data and len(data) > 0 else None
        except Exception as e:
            logger.warning("Profile %s: %s", ticker, e)
            return None

    def get_etf_info(self, ticker: str) -> Optional[dict]:
        try:
            data = self._request("etf/info", {"symbol": ticker})
            return data[0] if data and len(data) > 0 else None
        except Exception as e:
            logger.warning("ETF info %s: %s", ticker, e)
            return None

    def get_historical_prices(self, ticker: str, from_date: str = None, to_date: str = None) -> list:
        try:
            params = {"symbol": ticker}
            if from_date:
                params["from"] = from_date
            if to_date:
                params["to"] = to_date
            data = self._request("historical-price-eod/full", params)
            return data if isinstance(data, list) else []
        except Exception as e:
            logger.warning("Prices %s: %s", ticker, e)
            return []

    def get_dividends(self, ticker: str) -> list:
        try:
            data = self._request("dividends", {"symbol": ticker})
            return data if isinstance(data, list) else []
        except Exception as e:
            logger.warning("Dividends %s: %s", ticker, e)
            return []


# -----------------------------------------------------------------------------
# Helpers (mirror bootstrap_database.py logic)
# -----------------------------------------------------------------------------
def find_price_on_date(prices: list, target_date: datetime, lookback_days: int = 7) -> Optional[float]:
    target_str = target_date.strftime("%Y-%m-%d")
    min_date = (target_date - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    for row in prices:
        date_str = row.get("date", "")
        if min_date <= date_str <= target_str:
            return row.get("close")
    return None


def find_earliest_price(prices: list) -> Tuple[Optional[float], Optional[str]]:
    if not prices:
        return None, None
    earliest = prices[-1]
    return earliest.get("close"), earliest.get("date")


def calculate_dividends_in_range(dividends: list, start_date: datetime, end_date: datetime) -> float:
    total = 0.0
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    for div in dividends:
        div_date = div.get("date", "")
        if start_str <= div_date <= end_str:
            total += div.get("adjDividend", 0) or div.get("dividend", 0) or 0
    return total


# -----------------------------------------------------------------------------
# Enhanced ROC (from your implementation)
# -----------------------------------------------------------------------------
def estimate_roc_from_nav_erosion_enhanced(
    price_at_inception: Optional[float],
    latest_price: Optional[float],
    total_dividends: float,
    years_since_inception: float,
    ticker: str = "UNKNOWN",
    min_months: int = 3,
) -> Tuple[Optional[float], str]:
    """
    Enhanced ROC estimation from NAV erosion with better edge case handling.
    Returns (roc_percent, calculation_note).
    """
    min_years = min_months / 12
    if years_since_inception < min_years:
        logger.debug("%s: Too new (%.2f years, need %.2f)", ticker, years_since_inception, min_years)
        return None, f"ETF too new (< {min_months} months)"

    if not price_at_inception or not latest_price:
        logger.warning(
            "%s: Missing price data (inception: %s, latest: %s)",
            ticker, price_at_inception, latest_price,
        )
        return None, "Missing price data"

    if price_at_inception <= 0 or latest_price <= 0:
        logger.warning(
            "%s: Invalid price data (inception: %s, latest: %s)",
            ticker, price_at_inception, latest_price,
        )
        return None, "Invalid price data"

    if total_dividends <= 0:
        logger.info("%s: No dividends paid, ROC = 0%%", ticker)
        return 0.0, "No dividends paid"

    annual_dividends = total_dividends / years_since_inception
    price_change = latest_price - price_at_inception
    price_change_pct = (price_change / price_at_inception) * 100

    logger.info(
        "%s: Inception price: $%.2f, Latest: $%.2f, Change: %+.2f%%",
        ticker, price_at_inception, latest_price, price_change_pct,
    )
    logger.info("%s: Total dividends: $%.2f, Annual: $%.2f", ticker, total_dividends, annual_dividends)

    if price_change < 0:
        nav_erosion = abs(price_change)
        annual_erosion = nav_erosion / years_since_inception
        if annual_dividends > 0:
            roc_estimate = (annual_erosion / annual_dividends) * 100
            roc_capped = min(round(roc_estimate, 2), 100.0)
            logger.info("%s: NAV erosion detected, ROC = %.2f%%", ticker, roc_capped)
            return roc_capped, "Estimated from NAV erosion"
        return None, "Erosion exists but no dividends"

    total_return = price_change + total_dividends
    if price_change < total_dividends:
        underfunded_amount = total_dividends - price_change
        annual_underfunding = underfunded_amount / years_since_inception
        if annual_dividends > 0:
            roc_estimate = (annual_underfunding / annual_dividends) * 100
            roc_capped = min(round(roc_estimate, 2), 100.0)
            logger.info("%s: Price up but less than dividends, ROC = %.2f%%", ticker, roc_capped)
            return roc_capped, "Estimated from underfunded distributions"
        return 0.0, "Price increased"
    else:
        logger.info("%s: Price increased more than dividends, ROC = 0%%", ticker)
        return 0.0, "Price appreciation exceeds distributions"


def determine_canary_health(roc_percent: Optional[float]) -> str:
    if roc_percent is None:
        return "Unknown"
    if roc_percent >= 40:
        return "Dead"
    if roc_percent >= 20:
        return "Dying"
    return "Healthy"


def calculate_death_clock(roc_percent: Optional[float]) -> Optional[float]:
    if roc_percent is None or roc_percent <= 0:
        return None
    return round(50 / roc_percent, 2)


# -----------------------------------------------------------------------------
# Fetch ROC inputs for one ticker (FMP only, no DB)
# -----------------------------------------------------------------------------
def fetch_etf_roc_inputs(ticker: str, fmp: FMPClient) -> dict:
    """Fetch from FMP and compute the same inputs bootstrap uses for ROC."""
    today = datetime.now()
    five_years_ago = (today - timedelta(days=1825)).strftime("%Y-%m-%d")

    profile = fmp.get_etf_profile(ticker)
    etf_info = fmp.get_etf_info(ticker)
    prices = fmp.get_historical_prices(ticker, from_date=five_years_ago)
    dividends = fmp.get_dividends(ticker)

    inception_date = None
    inception_str = etf_info.get("inceptionDate") if etf_info else None
    if not inception_str and profile:
        inception_str = profile.get("ipoDate")
    if inception_str:
        try:
            if "T" in inception_str:
                inception_date = datetime.strptime(inception_str.split("T")[0], "%Y-%m-%d")
            else:
                inception_date = datetime.strptime(inception_str, "%Y-%m-%d")
        except Exception:
            pass

    latest_price = None
    latest_date = None
    if prices:
        latest_price = prices[0].get("close")
        latest_date = prices[0].get("date")

    price_at_inception = None
    effective_inception_date = inception_date
    if inception_date:
        price_at_inception = find_price_on_date(prices, inception_date, lookback_days=14)
    if not price_at_inception and prices:
        earliest_price, earliest_date = find_earliest_price(prices)
        if earliest_price:
            price_at_inception = earliest_price
            if earliest_date:
                try:
                    effective_inception_date = datetime.strptime(earliest_date, "%Y-%m-%d")
                except Exception:
                    pass

    dividends_since_inception = 0.0
    if effective_inception_date:
        dividends_since_inception = calculate_dividends_in_range(dividends, effective_inception_date, today)

    years_since_inception = 0.0
    if effective_inception_date:
        years_since_inception = (today - effective_inception_date).days / 365.0

    return {
        "ticker": ticker,
        "price_at_inception": price_at_inception,
        "latest_price": latest_price,
        "latest_date": latest_date,
        "dividends_since_inception": dividends_since_inception,
        "years_since_inception": years_since_inception,
        "inception_date": inception_date,
        "effective_inception_date": effective_inception_date,
        "name": (etf_info or {}).get("name") or (profile or {}).get("companyName") or ticker,
        "num_prices": len(prices),
        "num_dividends": len(dividends),
    }


# -----------------------------------------------------------------------------
# Run ROC test for one ticker and print report
# -----------------------------------------------------------------------------
def run_roc_test(ticker: str, fmp: FMPClient) -> None:
    """Fetch data, run enhanced ROC, print why ROC is null or the value."""
    print(f"\n{'='*70}")
    print(f"  ROC test: {ticker}")
    print("="*70)

    try:
        data = fetch_etf_roc_inputs(ticker, fmp)
    except Exception as e:
        print(f"  ERROR fetching data: {e}")
        return

    print("\n  Inputs (from FMP only, no DB):")
    print(f"    Name:                  {data.get('name', 'N/A')}")
    print(f"    Inception date:        {data.get('inception_date')}")
    print(f"    Effective inception:   {data.get('effective_inception_date')}")
    print(f"    Years since inception: {data.get('years_since_inception')}")
    print(f"    Price at inception:    {data.get('price_at_inception')}")
    print(f"    Latest price:          {data.get('latest_price')} ({data.get('latest_date')})")
    print(f"    Dividends since inc.:  {data.get('dividends_since_inception')}")
    print(f"    Price rows / div rows: {data.get('num_prices')} / {data.get('num_dividends')}")

    roc, note = estimate_roc_from_nav_erosion_enhanced(
        price_at_inception=data.get("price_at_inception"),
        latest_price=data.get("latest_price"),
        total_dividends=data.get("dividends_since_inception", 0),
        years_since_inception=data.get("years_since_inception", 0),
        ticker=ticker,
        min_months=3,
    )

    health = determine_canary_health(roc)
    death_clock = calculate_death_clock(roc)

    print("\n  ROC result:")
    if roc is None:
        print(f"    ROC:           null")
        print(f"    Reason:         {note}")
        print(f"    Canary health:  Unknown")
        print(f"    Death clock:    N/A")
    else:
        print(f"    ROC:           {roc}%")
        print(f"    Note:          {note}")
        print(f"    Canary health: {health}")
        print(f"    Death clock:   {death_clock} years")

    print("="*70)


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
def main():
    if not FMP_API_KEY:
        print("Missing FMP_API_KEY. Set it in .env.local (project root) or environment.")
        sys.exit(1)

    if len(sys.argv) > 1:
        tickers = [t.strip().upper() for t in sys.argv[1:] if t.strip()]
    else:
        tickers = DEFAULT_TICKERS

    print("ROC null / value test (local only, no database)")
    print("Tickers:", ", ".join(tickers))

    fmp = FMPClient(FMP_API_KEY)
    for ticker in tickers:
        run_roc_test(ticker, fmp)

    print("\nDone. Edit DEFAULT_TICKERS in this file or pass tickers as args.")
    print("Example: python \"data ingestion/test_roc_null_reasons.py\" QBY NVDY TSLY\n")


if __name__ == "__main__":
    main()
