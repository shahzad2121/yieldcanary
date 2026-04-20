"""
One-shot FMP diagnostic: every metric we care about, straight from the API.

- Mirrors production logic from bootstrap_database.py (YTD anchor Dec 31 / Jan 2,
  ROC with min_months=3, headline yield, 1Y, inception returns).
- Adds **unconstrained** views so you can see whether FMP data exists even when
  production rules hide it:
  - YTD using first EOD on or after Jan 1 of the current year (works for funds
    listed later in January or any month).
  - ROC computed with min_months=0 (no "too new → 0%" guard).

No Supabase, no DB writes, no ticker validation skip.

Usage (from repo root or from this folder; uses project-root .env.local):
  python "data ingestion/test-scripts/diagnose_fmp_etf_full_metrics.py"
  python "data ingestion/test-scripts/diagnose_fmp_etf_full_metrics.py" XSPI XQQI JEPI

Requires: FMP_API_KEY in .env.local at project root (same as other test-scripts).
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional

import requests

# -----------------------------------------------------------------------------
# Paths & env
# -----------------------------------------------------------------------------
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

DEFAULT_TICKERS = ["XSPI", "XQQI", "XBCI"]


# -----------------------------------------------------------------------------
# FMP client
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

    def _request(self, endpoint: str, params: dict | None = None) -> Any:
        if params is None:
            params = {}
        params["apikey"] = self.api_key
        url = f"{BASE_URL}/{endpoint}"
        self._wait()
        resp = requests.get(url, params=params, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and data.get("Error Message"):
            raise RuntimeError(str(data.get("Error Message")))
        return data

    def get_etf_profile(self, ticker: str) -> dict | None:
        try:
            data = self._request("profile", {"symbol": ticker})
            return data[0] if isinstance(data, list) and len(data) > 0 else None
        except Exception as e:
            return {"_error": str(e)}

    def get_etf_info(self, ticker: str) -> dict | None:
        try:
            data = self._request("etf/info", {"symbol": ticker})
            return data[0] if isinstance(data, list) and len(data) > 0 else None
        except Exception as e:
            return {"_error": str(e)}

    def get_historical_prices(
        self, ticker: str, from_date: str | None = None, to_date: str | None = None
    ) -> list:
        try:
            params: dict[str, str] = {"symbol": ticker}
            if from_date:
                params["from"] = from_date
            if to_date:
                params["to"] = to_date
            data = self._request("historical-price-eod/full", params)
            return data if isinstance(data, list) else []
        except Exception as e:
            print(f"    historical-price-eod/full error {ticker}: {e}")
            return []

    def get_dividends(self, ticker: str) -> list:
        try:
            data = self._request("dividends", {"symbol": ticker})
            return data if isinstance(data, list) else []
        except Exception as e:
            print(f"    dividends error {ticker}: {e}")
            return []


# -----------------------------------------------------------------------------
# Helpers (aligned with bootstrap_database.py)
# -----------------------------------------------------------------------------
def find_price_on_date(
    prices: list, target_date: datetime, lookback_days: int = 7
) -> Optional[float]:
    target_str = target_date.strftime("%Y-%m-%d")
    min_date = (target_date - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    for price_data in prices:
        date_str = price_data.get("date", "")
        if min_date <= date_str <= target_str:
            return price_data.get("close")
    return None


def find_earliest_price(prices: list) -> tuple[Optional[float], Optional[str]]:
    if not prices:
        return None, None
    earliest = prices[-1]
    return earliest.get("close"), earliest.get("date")


def first_close_on_or_after(
    prices: list, on_or_after: date
) -> tuple[Optional[float], Optional[str]]:
    """Chronological first bar with date >= on_or_after (uses close)."""
    if not prices:
        return None, None
    threshold = on_or_after.strftime("%Y-%m-%d")
    for row in reversed(prices):
        d = row.get("date", "")
        if d >= threshold:
            return row.get("close"), d
    return None, None


def calculate_dividends_in_range(
    dividends: list, start_date: date | datetime, end_date: date | datetime
) -> float:
    total = 0.0
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    for div in dividends:
        div_date = div.get("date", "")
        if start_str <= div_date <= end_str:
            total += float(div.get("adjDividend", 0) or div.get("dividend", 0) or 0)
    return total


def estimate_roc_from_nav_erosion(
    price_at_inception: Optional[float],
    latest_price: Optional[float],
    total_dividends: float,
    years_since_inception: float,
    min_months: int = 3,
) -> Optional[float]:
    """Same logic as bootstrap_database.py."""
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


def parse_inception_datetime(
    etf_info: dict | None, profile: dict | None
) -> Optional[datetime]:
    inception_str = None
    if etf_info and not etf_info.get("_error"):
        inception_str = etf_info.get("inceptionDate")
    if not inception_str and profile and not profile.get("_error"):
        inception_str = profile.get("ipoDate")
    if not inception_str:
        return None
    try:
        if "T" in inception_str:
            inception_str = inception_str.split("T")[0]
        return datetime.strptime(inception_str, "%Y-%m-%d")
    except ValueError:
        return None


def pct_ratio(num: float, den: float) -> Optional[float]:
    if not den or den <= 0:
        return None
    return round((num / den - 1) * 100, 4)


def spent_div_return(latest: float, anchor: float, divs: float) -> Optional[float]:
    if not anchor or anchor <= 0:
        return None
    return round((((latest - anchor) + divs) / anchor) * 100, 4)


def analyze_ticker(ticker: str, fmp: FMPClient) -> None:
    ticker = ticker.upper().strip()
    today = datetime.now()
    today_d = today.date()
    one_year_ago = today - timedelta(days=365)
    ytd_start = datetime(today.year, 1, 1)
    five_years_ago = (today - timedelta(days=1825)).strftime("%Y-%m-%d")

    print("\n" + "=" * 78)
    print(f"  {ticker}")
    print("=" * 78)

    profile = fmp.get_etf_profile(ticker)
    etf_info = fmp.get_etf_info(ticker)
    prices = fmp.get_historical_prices(ticker, from_date=five_years_ago)
    dividends = fmp.get_dividends(ticker)

    if isinstance(profile, dict) and profile.get("_error"):
        print(f"  profile: ERROR {profile['_error']}")
        profile = None
    if isinstance(etf_info, dict) and etf_info.get("_error"):
        print(f"  etf/info: ERROR {etf_info['_error']}")
        etf_info = None

    name = (etf_info or {}).get("name") or (profile or {}).get("companyName") or ticker
    print(f"  name: {name}")

    inception_dt = parse_inception_datetime(etf_info, profile)
    print(f"  inception (FMP): {inception_dt.date() if inception_dt else 'N/A'}")

    print(f"\n  --- Raw FMP payloads (counts) ---")
    print(f"  historical EOD rows: {len(prices)}")
    print(f"  dividend rows: {len(dividends)}")

    if not prices:
        print("  STOP: no prices — nothing else to compute.")
        return

    latest_price = prices[0].get("close")
    latest_date = prices[0].get("date")
    earliest_close, earliest_date = find_earliest_price(prices)
    print(f"  first EOD in window: {earliest_date} close={earliest_close}")
    print(f"  latest EOD:        {latest_date} close={latest_price}")

    if dividends:
        div_dates = [d.get("date") for d in dividends if d.get("date")]
        div_dates.sort()
        print(f"  first div date: {div_dates[0]}")
        print(f"  last div date:  {div_dates[-1]}")

    # Effective inception / price at inception (same as bootstrap)
    effective_inception = inception_dt
    price_at_inception = None
    if inception_dt:
        price_at_inception = find_price_on_date(prices, inception_dt, lookback_days=14)
    if not price_at_inception and prices:
        price_at_inception = earliest_close
        if earliest_date:
            try:
                effective_inception = datetime.strptime(earliest_date, "%Y-%m-%d")
            except ValueError:
                pass

    print(f"\n  --- Anchors used in production (bootstrap_database.py) ---")
    ytd_anchor_dec31 = find_price_on_date(
        prices, datetime(today.year - 1, 12, 31), lookback_days=7
    )
    ytd_anchor_jan2 = find_price_on_date(prices, datetime(today.year, 1, 2), lookback_days=7)
    price_ytd_production = ytd_anchor_dec31 or ytd_anchor_jan2
    print(f"  price Dec31 lookback: {ytd_anchor_dec31}")
    print(f"  price Jan2 lookback:  {ytd_anchor_jan2}")
    print(f"  -> price_ytd_start (prod): {price_ytd_production}")

    jan1 = date(today.year, 1, 1)
    ytd_flexible_close, ytd_flexible_date = first_close_on_or_after(prices, jan1)
    print(f"\n  --- Unconstrained YTD anchor (first close on/after {jan1.isoformat()}) ---")
    print(f"  date: {ytd_flexible_date}  close: {ytd_flexible_close}")

    dividends_last_12mo = calculate_dividends_in_range(dividends, one_year_ago, today)
    dividends_ytd = calculate_dividends_in_range(dividends, ytd_start, today)
    divs_since_inception = 0.0
    if effective_inception:
        divs_since_inception = calculate_dividends_in_range(
            dividends, effective_inception, today
        )

    lp = float(latest_price) if latest_price else 0.0

    print(f"\n  --- Dividend sums ($) ---")
    print(f"  last ~365d: {round(dividends_last_12mo, 6)}")
    print(f"  YTD ({today.year}-01-01 .. today): {round(dividends_ytd, 6)}")
    print(f"  since effective inception: {round(divs_since_inception, 6)}")

    headline = round((dividends_last_12mo / lp) * 100, 4) if lp > 0 else None
    print(f"\n  --- Yields ---")
    print(f"  headline yield TTM % (divs_12mo / latest): {headline}")

    price_1y = find_price_on_date(prices, one_year_ago, lookback_days=7)

    print(f"\n  --- Returns: production-style (needs anchor) ---")
    tr_ytd_prod = pct_ratio(lp, float(price_ytd_production)) if price_ytd_production else None
    sd_ytd_prod = spent_div_return(lp, float(price_ytd_production), dividends_ytd) if price_ytd_production else None
    print(f"  total return YTD %:           {tr_ytd_prod}  (null if no prod anchor)")
    print(f"  spent-dividends return YTD %: {sd_ytd_prod}")

    print(f"\n  --- Returns: flexible YTD anchor (data exists?) ---")
    tr_ytd_flex = pct_ratio(lp, float(ytd_flexible_close)) if ytd_flexible_close else None
    if ytd_flexible_date:
        try:
            flex_start = datetime.strptime(ytd_flexible_date, "%Y-%m-%d")
        except ValueError:
            flex_start = ytd_start
    else:
        flex_start = ytd_start
    divs_flex_ytd = calculate_dividends_in_range(dividends, flex_start, today)
    sd_ytd_flex = (
        spent_div_return(lp, float(ytd_flexible_close), divs_flex_ytd)
        if ytd_flexible_close
        else None
    )
    print(f"  total return YTD % (flex):           {tr_ytd_flex}")
    print(f"  spent-dividends return YTD % (flex): {sd_ytd_flex}")
    print(f"  (flex div sum from anchor date {ytd_flexible_date or 'N/A'} through today)")

    print(f"\n  --- 1Y & since inception (unconstrained anchors) ---")
    tr_1y = pct_ratio(lp, float(price_1y)) if price_1y else None
    print(f"  price ~365d ago (7d lookback): {price_1y}")
    print(f"  total return 1Y %: {tr_1y}")
    tr_inc = pct_ratio(lp, float(price_at_inception)) if price_at_inception else None
    sd_inc = (
        spent_div_return(lp, float(price_at_inception), divs_since_inception)
        if price_at_inception
        else None
    )
    print(f"  price at effective inception: {price_at_inception} ({effective_inception.date() if effective_inception else 'N/A'})")
    print(f"  total return since inception %: {tr_inc}")
    print(f"  spent-dividends since inception %: {sd_inc}")

    years_si = (
        (today_d - effective_inception.date()).days / 365.0
        if effective_inception
        else 0.0
    )
    roc_prod = None
    roc_raw = None
    if effective_inception and price_at_inception and latest_price:
        roc_prod = estimate_roc_from_nav_erosion(
            price_at_inception,
            latest_price,
            divs_since_inception,
            years_si,
            min_months=3,
        )
        roc_raw = estimate_roc_from_nav_erosion(
            price_at_inception,
            latest_price,
            divs_since_inception,
            years_si,
            min_months=0,
        )
    print(f"\n  --- ROC (nav erosion model) ---")
    print(f"  years since effective inception: {round(years_si, 4)}")
    print(f"  ROC % min_months=3 (production): {roc_prod}")
    print(f"  ROC % min_months=0 (no 'too new' guard): {roc_raw}")

    true_prod = (
        round(float(headline) * (1 - float(roc_prod) / 100), 4)
        if headline is not None and roc_prod is not None
        else None
    )
    true_raw = (
        round(float(headline) * (1 - float(roc_raw) / 100), 4)
        if headline is not None and roc_raw is not None
        else None
    )
    print(f"\n  --- Derived true income yield (headline × (1 - ROC/100)) ---")
    print(f"  using prod ROC: {true_prod}")
    print(f"  using raw ROC:  {true_raw}")

    print(f"\n  --- Optional: dump first/last 2 price rows (JSON) ---")
    sample = {
        "newest": prices[:2],
        "oldest": prices[-2:] if len(prices) >= 2 else prices[-1:],
    }
    print(json.dumps(sample, indent=2))


def main() -> int:
    tickers = [t.upper().strip() for t in sys.argv[1:]] if len(sys.argv) > 1 else DEFAULT_TICKERS

    if not FMP_API_KEY:
        print("Missing FMP_API_KEY. Add it to .env.local at project root.")
        return 1

    print("FMP full-metrics diagnostic (read-only, no DB)")
    print(f"As-of: {datetime.now().isoformat(timespec='seconds')}")
    print(f"Tickers: {', '.join(tickers)}")
    print("Note: uses raw FMP 'close' series; production ingestion may adjust for splits.")

    fmp = FMPClient(FMP_API_KEY)
    for t in tickers:
        try:
            analyze_ticker(t, fmp)
        except Exception as e:
            print(f"\n  ERROR {t}: {e}")
            raise
    print("\n" + "=" * 78)
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
