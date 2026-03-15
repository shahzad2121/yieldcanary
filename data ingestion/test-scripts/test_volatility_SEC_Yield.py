"""
Test volatility (1Y annualized) and SEC-style yield using FMP data only.

Uses same FMP endpoints and SEC formula as frontend: historical-price-eod/full, etf/info (expense), dividends (30d sum).
No numpy; standard library only (math, statistics).

Usage:
  python "data ingestion/test-scripts/test_volatility_SEC_Yield.py"
  python "data ingestion/test-scripts/test_volatility_SEC_Yield.py" PLTW SPY

Requires: .env.local with FMP_API_KEY (project root or data ingestion).
"""

import os
import sys
import time
import math
import statistics
from datetime import datetime, timedelta
from pathlib import Path

_script_dir = Path(__file__).resolve().parent
_project_root = _script_dir.parent.parent
_env_path = _project_root / ".env.local"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path)
else:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
    load_dotenv("../.env.local")

import requests

FMP_API_KEY = os.getenv("FMP_API_KEY")
FMP_BASE_URL = "https://financialmodelingprep.com/stable"
MIN_INTERVAL = 60.0 / 300  # 300 req/min

DEFAULT_TICKERS = ["PLTW", "PLTY", "SPY", "QQQ"]


def fmp_request(endpoint: str, params: dict) -> list | dict:
    """Call FMP stable API; return parsed JSON. Raises on HTTP error or FMP error message."""
    url = f"{FMP_BASE_URL}/{endpoint}"
    params = {**params, "apikey": FMP_API_KEY}
    time.sleep(MIN_INTERVAL)
    resp = requests.get(url, params=params, timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(f"FMP HTTP {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    if isinstance(data, dict) and data.get("Error Message"):
        raise RuntimeError(data["Error Message"])
    return data


SEC_YIELD_DAYS = 30


def fetch_historical_prices(ticker: str) -> tuple[list[float], str] | None:
    """
    Fetch historical EOD prices (same endpoint as etf-deep-dive / bootstrap).
    Returns (list of closes oldest-first, last_date_yyyy_mm_dd) or None on error.
    """
    try:
        data = fmp_request("historical-price-eod/full", {"symbol": ticker, "serietype": "line"})
    except Exception as e:
        print(f"  Price fetch failed: {e}")
        return None
    if not isinstance(data, list) or len(data) == 0:
        print(f"  No price data (empty or not list)")
        return None
    sorted_rows = sorted(data, key=lambda r: r.get("date") or "")
    prices = []
    for row in sorted_rows:
        c = row.get("close")
        if c is not None and isinstance(c, (int, float)):
            prices.append(float(c))
    if len(prices) < 2:
        print(f"  Not enough price points ({len(prices)})")
        return None
    last_date = (sorted_rows[-1].get("date") or "")[:10]
    return (prices, last_date)


def fetch_etf_info(ticker: str) -> dict | None:
    """Fetch FMP etf/info for expenseRatio (same as bootstrap)."""
    try:
        data = fmp_request("etf/info", {"symbol": ticker})
        if isinstance(data, list) and len(data) > 0:
            return data[0]
    except Exception as e:
        print(f"  ETF info fetch failed: {e}")
    return None


def fetch_dividends(ticker: str) -> list[dict]:
    """
    Fetch dividend history. Return list of dicts with exDate, paymentDate, amount
    (same shape as frontend dividendEvents: exDate/paymentDate/declarationDate, amount).
    """
    try:
        data = fmp_request("dividends", {"symbol": ticker})
        if not isinstance(data, list):
            return []
        out = []
        for row in data:
            ex = row.get("exDividendDate") or row.get("date")
            pay = row.get("paymentDate")
            dec = row.get("declarationDate")
            amt = row.get("adjDividend") if row.get("adjDividend") is not None else row.get("dividend", 0)
            if amt is None:
                amt = 0
            out.append({"exDate": ex, "paymentDate": pay, "declarationDate": dec, "amount": float(amt)})
        return out
    except Exception:
        return []


def calculate_volatility(prices: list) -> float:
    """
    Annualized volatility: std(daily returns) * sqrt(252).
    Same logic as frontend useEtfDeepDiveData.
    """
    if not prices or len(prices) < 2:
        return 0.0
    returns = [(prices[i] - prices[i - 1]) / prices[i - 1] for i in range(1, len(prices))]
    daily_vol = statistics.stdev(returns)
    return daily_vol * math.sqrt(252) * 100  # percent


def calculate_sec_yield_30d(
    dividend_events: list[dict],
    end_date_str: str,
    d: float,
    expense_ratio_pct: float,
) -> float | None:
    """
    SEC 30-day yield: same formula as frontend useEtfDeepDiveData.secYield30d.
    2 * [ ((a - b) / d) + 1 ]^6 - 1, where a=divs in 30d, b=expense per share, d=price.
    Returns yield as decimal (e.g. 0.085); None if no valid result.
    """
    if d <= 0 or not end_date_str:
        return None
    end_d = datetime.strptime(end_date_str[:10], "%Y-%m-%d")
    start_d = end_d - timedelta(days=SEC_YIELD_DAYS)
    a = 0.0
    for ev in dividend_events:
        key = ev.get("exDate") or ev.get("paymentDate") or ev.get("declarationDate")
        if not key:
            continue
        try:
            t = datetime.strptime(str(key)[:10], "%Y-%m-%d")
        except ValueError:
            continue
        if start_d <= t <= end_d:
            a += ev.get("amount", 0) or 0
    b = (expense_ratio_pct / 100) * d * (SEC_YIELD_DAYS / 365)
    ratio = (a - b) / d + 1
    if ratio <= 0:
        return None
    return 2 * (ratio ** 6) - 1


def main(tickers: list[str]) -> list[dict]:
    if not FMP_API_KEY:
        print("Missing FMP_API_KEY in .env.local")
        return []

    results = []
    for i, ticker in enumerate(tickers):
        print(f"\n[{i+1}/{len(tickers)}] {ticker}")
        price_result = fetch_historical_prices(ticker)
        if not price_result:
            results.append({"ticker": ticker, "error": "no prices"})
            continue
        prices, last_date = price_result
        nav = prices[-1]

        dividends = fetch_dividends(ticker)
        etf_info = fetch_etf_info(ticker)
        expense_ratio = float(etf_info.get("expenseRatio", 0) or 0) if etf_info else 0.0

        vol = calculate_volatility(prices)
        sec_decimal = calculate_sec_yield_30d(dividends, last_date, nav, expense_ratio)
        sec_pct = (sec_decimal * 100) if sec_decimal is not None else None

        results.append({
            "ticker": ticker,
            "NAV": round(nav, 2),
            "volatility_%": round(vol, 2),
            "SEC_yield_%": round(sec_pct, 2) if sec_pct is not None else None,
            "price_days": len(prices),
        })
        sec_str = f"{sec_pct:.2f}%" if sec_pct is not None else "—"
        print(f"  NAV={nav:.2f}  vol={vol:.2f}%  SEC_yield_30d={sec_str}  days={len(prices)}")

    return results


if __name__ == "__main__":
    tickers = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_TICKERS
    print(f"FMP base: {FMP_BASE_URL}")
    print(f"Tickers: {tickers}")
    output = main(tickers)
    print("\n--- Summary ---")
    for r in output:
        if "error" in r:
            print(f"  {r['ticker']}: {r['error']}")
        else:
            sec = f"{r['SEC_yield_%']}%" if r.get("SEC_yield_%") is not None else "—"
            print(f"  {r['ticker']}: vol={r['volatility_%']}%  SEC_yield_30d={sec}  NAV={r['NAV']}  days={r['price_days']}")
