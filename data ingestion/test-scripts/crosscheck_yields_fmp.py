"""
Cross-check yields using FMP only (no DB).

Fetches 5Y historical prices, dividends, and etf/info from FMP, then computes:
- Headline yield (TTM) = sum(dividends last 365 days) / latest price × 100
- ROC (from NAV erosion since inception)
- True income yield = headline_yield_ttm × (1 - roc_latest/100)

Usage:
  python crosscheck_yields_fmp.py [TICKER ...]
  python crosscheck_yields_fmp.py              # runs default tickers

Requires: .env.local with FMP_API_KEY (project root).
"""

import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import requests

# Load .env from project root (parent of "data ingestion")
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_INGESTION_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = DATA_INGESTION_DIR.parent
ENV_PATH = PROJECT_ROOT / ".env.local"

def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip()
            if key and value and key not in os.environ:
                os.environ[key] = value

load_dotenv(ENV_PATH)

FMP_API_KEY = os.getenv("FMP_API_KEY")
BASE_URL = "https://financialmodelingprep.com/stable"

# Default tickers if none given
DEFAULT_TICKERS = ["JEPI", "YMAX", "YQQQ", "YMAG", "YETH" , "AMZP", "MDST"]


# -----------------------------------------------------------------------------
# FMP client (read-only)
# -----------------------------------------------------------------------------
class FMPClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._last_request = 0.0
        self._min_interval = 60.0 / 300

    def _wait(self) -> None:
        elapsed = time.time() - self._last_request
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_request = time.time()

    def _request(self, endpoint: str, params: dict = None):  # noqa: ANN001
        if params is None:
            params = {}
        params["apikey"] = self.api_key
        url = f"{BASE_URL}/{endpoint}"
        self._wait()
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and data.get("Error Message"):
            raise RuntimeError(data["Error Message"])
        return data

    def get_etf_info(self, ticker: str) -> dict | None:
        try:
            data = self._request("etf/info", {"symbol": ticker})
            return data[0] if data and len(data) > 0 else None
        except Exception as e:
            print(f"    etf/info error {ticker}: {e}")
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
            print(f"    historical prices error {ticker}: {e}")
            return []

    def get_dividends(self, ticker: str) -> list:
        try:
            data = self._request("dividends", {"symbol": ticker})
            return data if isinstance(data, list) else []
        except Exception as e:
            print(f"    dividends error {ticker}: {e}")
            return []


# -----------------------------------------------------------------------------
# Helpers (same logic as bootstrap_database.py)
# -----------------------------------------------------------------------------
def find_price_on_date(prices: list, target_date: datetime, lookback_days: int = 7) -> float | None:
    target_str = target_date.strftime("%Y-%m-%d")
    min_date = (target_date - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    for row in prices:
        date_str = row.get("date", "")
        if min_date <= date_str <= target_str:
            return row.get("close")
    return None


def find_earliest_price(prices: list) -> tuple[float | None, str | None]:
    if not prices:
        return None, None
    earliest = prices[-1]
    return earliest.get("close"), earliest.get("date")


def calculate_dividends_in_range(
    dividends: list, start_date: date | datetime, end_date: date | datetime
) -> float:
    total = 0.0
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    for div in dividends:
        div_date = div.get("date", "")
        if start_str <= div_date <= end_str:
            total += div.get("adjDividend", 0) or div.get("dividend", 0) or 0
    return total


def estimate_roc_from_nav_erosion(
    price_at_inception: float | None,
    latest_price: float | None,
    total_dividends: float,
    years_since_inception: float,
    min_months: int = 3,
) -> float | None:
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
            roc_estimate = min((annual_nav_erosion / annual_dividends) * 100, 100)
            return round(roc_estimate, 2)
    else:
        annual_price_gain = price_change / years_since_inception
        annual_dividends = total_dividends / years_since_inception
        if annual_dividends > annual_price_gain:
            shortfall = annual_dividends - annual_price_gain
            roc_estimate = min((shortfall / annual_dividends) * 100, 100)
            return round(roc_estimate, 2)
    return 0.0


# -----------------------------------------------------------------------------
# Compute yields from FMP data (no DB)
# -----------------------------------------------------------------------------
def parse_inception_date(etf_info: dict | None) -> date | None:
    if not etf_info:
        return None
    inception_str = etf_info.get("inceptionDate")
    if not inception_str:
        return None
    try:
        if "T" in inception_str:
            inception_str = inception_str.split("T")[0]
        return datetime.strptime(inception_str, "%Y-%m-%d").date()
    except ValueError:
        return None


def compute_yields_for_ticker(ticker: str, fmp: FMPClient) -> dict | None:
    today = datetime.now().date()
    one_year_ago = today - timedelta(days=365)
    five_years_ago = today - timedelta(days=5 * 365)
    from_str = five_years_ago.strftime("%Y-%m-%d")
    to_str = today.strftime("%Y-%m-%d")

    etf_info = fmp.get_etf_info(ticker)
    prices = fmp.get_historical_prices(ticker, from_date=from_str, to_date=to_str)
    dividends = fmp.get_dividends(ticker)

    if not prices:
        print(f"  {ticker}: No price data from FMP")
        return None

    # FMP returns newest first
    latest_price = prices[0].get("close")
    latest_date = prices[0].get("date")
    if not latest_price or latest_price <= 0:
        print(f"  {ticker}: No valid latest price")
        return None

    dividends_last_12mo = calculate_dividends_in_range(dividends, one_year_ago, today)

    headline_yield_ttm = round((dividends_last_12mo / float(latest_price)) * 100, 2)

    inception_date = parse_inception_date(etf_info)
    effective_inception = inception_date
    price_at_inception = None

    if inception_date:
        # find_price_on_date expects a datetime for target_date
        inception_dt = datetime.combine(inception_date, datetime.min.time())
        price_at_inception = find_price_on_date(prices, inception_dt, lookback_days=14)
    if not price_at_inception and prices:
        price_at_inception, earliest_date = find_earliest_price(prices)
        if earliest_date:
            try:
                effective_inception = datetime.strptime(earliest_date, "%Y-%m-%d").date()
            except ValueError:
                pass

    roc_latest = None
    if effective_inception and price_at_inception:
        years_since_inception = (today - effective_inception).days / 365.0
        dividends_since_inception = calculate_dividends_in_range(dividends, effective_inception, today)
        roc_latest = estimate_roc_from_nav_erosion(
            price_at_inception,
            latest_price,
            dividends_since_inception,
            years_since_inception,
            min_months=3,
        )
    if roc_latest is None:
        roc_latest = 0.0

    true_income_yield = round(headline_yield_ttm * (1 - roc_latest / 100), 2)

    return {
        "ticker": ticker,
        "latest_price": latest_price,
        "latest_date": latest_date,
        "dividends_last_12mo": round(dividends_last_12mo, 4),
        "headline_yield_ttm": headline_yield_ttm,
        "roc_latest": roc_latest,
        "true_income_yield": true_income_yield,
    }


def main() -> None:
    tickers = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_TICKERS

    if not FMP_API_KEY:
        print("Missing FMP_API_KEY. Set it in .env.local (project root) or environment.")
        sys.exit(1)

    print("=" * 70)
    print("Yield cross-check from FMP (5Y data, no DB)")
    print("=" * 70)
    print(f"Tickers: {', '.join(tickers)}")
    print(f"Formulas: headline = divs_12mo / price × 100; true = headline × (1 - ROC/100)")
    print()

    fmp = FMPClient(FMP_API_KEY)
    results = []

    for ticker in tickers:
        r = compute_yields_for_ticker(ticker, fmp)
        if r:
            results.append(r)

    if not results:
        print("No results.")
        return

    print()
    print("-" * 70)
    print(f"{'Ticker':<8} {'Headline %':>10} {'ROC %':>8} {'True yield %':>12}  (latest price, divs 12mo)")
    print("-" * 70)
    for r in results:
        print(
            f"{r['ticker']:<8} {r['headline_yield_ttm']:>10.2f} {r['roc_latest']:>8.2f} {r['true_income_yield']:>12.2f}   "
            f"(${r['latest_price']:.2f}, ${r['dividends_last_12mo']:.4f})"
        )
    print("-" * 70)
    print("Compare 'True yield %' with your app; if FMP shows >10% and app shows 10%, data was capped.")
    print()


if __name__ == "__main__":
    main()
