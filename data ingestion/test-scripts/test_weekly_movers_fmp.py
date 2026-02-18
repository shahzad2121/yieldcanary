"""
Test script: Biggest Deteriorations of the Week using LIVE FMP data only.

Fetches prices and dividends from FMP for each ticker, computes ROC / Death Clock /
True Income as-of "last week end" and "this week" (today), then outputs the top 5
biggest deteriorations (week-over-week worsening). No database used.

Usage:
  python "data ingestion/test-scripts/test_weekly_movers_fmp.py"
  python "data ingestion/test-scripts/test_weekly_movers_fmp.py" TSLY JEPI CONY   # specific tickers

Requires: .env.local with FMP_API_KEY (project root).
"""

import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests

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

# Subset of high-yield ETFs for quick test (or pass via CLI)
DEFAULT_TICKERS = [
    "TSLY", "JEPI", "CONY", "NVDY", "AMDY", "QQQY", "XYLD", "QYLD",
    "SVOL", "JEPQ", "YMAX", "FEPI", "TSII", "OARK", "YBIT",
]


class FMPClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._last_request = 0.0
        self._min_interval = 60.0 / 250

    def _wait(self) -> None:
        elapsed = time.time() - self._last_request
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_request = time.time()

    def _request(self, endpoint: str, params: dict | None = None):
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

    def get_historical_prices(
        self, ticker: str, from_date: str | None = None, to_date: str | None = None
    ) -> list:
        try:
            params = {"symbol": ticker}
            if from_date:
                params["from"] = from_date
            if to_date:
                params["to"] = to_date
            data = self._request("historical-price-eod/full", params)
            return data if isinstance(data, list) else []
        except Exception as e:
            print(f"    prices error {ticker}: {e}")
            return []

    def get_dividends(self, ticker: str) -> list:
        try:
            data = self._request("dividends", {"symbol": ticker})
            return data if isinstance(data, list) else []
        except Exception as e:
            print(f"    dividends error {ticker}: {e}")
            return []


def find_price_on_date(prices: list, target_date: datetime, lookback_days: int = 14) -> float | None:
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
    dividends: list, start_date: datetime, end_date: datetime
) -> float:
    total = 0.0
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    for div in dividends:
        date_str = div.get("date", "")
        if start_str <= date_str <= end_str:
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
        annual_nav = nav_erosion / years_since_inception
        annual_div = total_dividends / years_since_inception
        if annual_div > 0:
            return round(min((annual_nav / annual_div) * 100, 100), 2)
    else:
        annual_gain = price_change / years_since_inception
        annual_div = total_dividends / years_since_inception
        if annual_div > annual_gain:
            shortfall = annual_div - annual_gain
            return round(min((shortfall / annual_div) * 100, 100), 2)
    return 0.0


def calculate_death_clock(roc: float | None) -> float | None:
    if roc is None or roc <= 0:
        return None
    return round(50 / roc, 2)


def compute_metrics_as_of(
    ticker: str,
    fmp: FMPClient,
    as_of_date: datetime,
    five_years_ago_str: str,
) -> dict | None:
    """Compute ROC, death_clock, true_income as of a given date using FMP data."""
    etf_info = fmp.get_etf_info(ticker)
    prices = fmp.get_historical_prices(ticker, from_date=five_years_ago_str, to_date=as_of_date.strftime("%Y-%m-%d"))
    dividends = fmp.get_dividends(ticker)

    if not prices:
        return None

    inception_str = None
    if etf_info and etf_info.get("inceptionDate"):
        inception_str = etf_info["inceptionDate"][:10]
    if not inception_str:
        return None

    try:
        inception_dt = datetime.strptime(inception_str, "%Y-%m-%d")
    except ValueError:
        return None

    latest_price = find_price_on_date(prices, as_of_date, lookback_days=14)
    if not latest_price:
        return None

    price_at_inception = find_price_on_date(prices, inception_dt, lookback_days=14)
    if not price_at_inception:
        ep, ed = find_earliest_price(prices)
        if ep:
            price_at_inception = ep

    if not price_at_inception:
        return None

    years_since = (as_of_date - inception_dt).days / 365.0
    if years_since < 0:
        return None

    one_year_before = as_of_date - timedelta(days=365)
    dividends_since_inception = calculate_dividends_in_range(dividends, inception_dt, as_of_date)
    dividends_last_12mo = calculate_dividends_in_range(dividends, one_year_before, as_of_date)

    roc = estimate_roc_from_nav_erosion(
        price_at_inception, latest_price, dividends_since_inception, years_since
    )
    if roc is None:
        return None

    death_clock = calculate_death_clock(roc)
    headline_yield = (dividends_last_12mo / latest_price) * 100 if latest_price > 0 else None
    true_income = headline_yield * (1 - roc / 100) if headline_yield is not None else None

    return {
        "roc": roc,
        "death_clock": death_clock,
        "true_income": true_income,
    }


def main() -> None:
    if not FMP_API_KEY:
        print("Missing FMP_API_KEY. Set in .env.local (project root) or env.")
        sys.exit(1)

    tickers = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_TICKERS
    today = datetime.now()
    # Week boundaries (Monday as start)
    weekday = today.weekday()
    this_week_monday = today - timedelta(days=weekday)
    last_week_monday = this_week_monday - timedelta(days=7)
    last_week_end = last_week_monday + timedelta(days=6)  # Sunday
    five_years_ago = (today - timedelta(days=1825)).strftime("%Y-%m-%d")

    print("=" * 60)
    print("Biggest Deteriorations of the Week (LIVE from FMP)")
    print("=" * 60)
    print(f"  Last week end: {last_week_end.strftime('%Y-%m-%d')}")
    print(f"  This week (today): {today.strftime('%Y-%m-%d')}")
    print(f"  Tickers: {len(tickers)}")
    print()

    fmp = FMPClient(FMP_API_KEY)
    movers = []

    for i, ticker in enumerate(tickers, 1):
        print(f"  [{i}/{len(tickers)}] {ticker}...", end=" ", flush=True)
        prev = compute_metrics_as_of(ticker, fmp, last_week_end, five_years_ago)
        curr = compute_metrics_as_of(ticker, fmp, today, five_years_ago)
        if not prev or not curr:
            print("skip (insufficient data)")
            continue
        roc_c = curr["roc"] - prev["roc"]
        dc_c = (curr["death_clock"] or 0) - (prev["death_clock"] or 0)
        ti_c = (curr["true_income"] or 0) - (prev["true_income"] or 0)
        score = -roc_c + dc_c + ti_c  # lower = deterioration
        movers.append({
            "ticker": ticker,
            "roc_change": roc_c,
            "death_clock_change": dc_c,
            "true_income_change": ti_c,
            "score": score,
        })
        print(f"ΔROC={roc_c:+.2f}% ΔDC={dc_c:+.2f}y ΔTI={ti_c:+.2f}%")

    # Sort by score ascending = biggest deteriorations first
    movers.sort(key=lambda m: m["score"])
    top5 = movers[:5]

    print()
    print("=" * 60)
    print("Top 5 Biggest Deteriorations (lowest score first)")
    print("=" * 60)
    for m in top5:
        print(f"  {m['ticker']:6}  ROC Δ: {m['roc_change']:+.2f}%   Death Clock Δ: {m['death_clock_change']:+.2f}y   True Income Δ: {m['true_income_change']:+.2f}%")
    print("=" * 60)


if __name__ == "__main__":
    main()