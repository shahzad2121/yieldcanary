"""
One-time script: Seed etf_monthly_roc with historical ROC for the past N months.

For each ETF in the `etfs` table and for each calendar month in the lookback
window, this script:
  1. Pulls historical prices and dividends from FMP once per ticker.
  2. For each month, computes ROC "as of" the last calendar day of that month
     using the same NAV-erosion formula used by bootstrap_database.py.
  3. Upserts one row per (ticker, month) into etf_monthly_roc.

ROC formula (same as bootstrap_database.py → estimate_roc_from_nav_erosion):
  - Inception price  : earliest available price on or before inception date
  - Cutoff price     : price on or before last day of the target month
  - Dividends        : all dividends from inception up to last day of target month
  - Case 1 (price ↓) : roc = annual_nav_erosion / annual_dividends × 100, capped 100
  - Case 2 (price ↑) : roc = shortfall / annual_dividends × 100 if underfunded
  - Case 3           : roc = 0.0 (fully covered by gains)

Usage
-----
Run from project root:

    python "data ingestion/seed_monthly_roc_history.py"

Optional flags:
    --lookback-months 18     (default: 18)
    --dry-run                (compute + log but skip DB upsert)
    --ticker QQQI MSTY ...   (process only specific tickers; default: all in DB)

Requirements
------------
    VITE_SUPABASE_URL / SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    FMP_API_KEY
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime, timedelta
from typing import Optional

import requests
from dotenv import load_dotenv
from supabase import Client, create_client


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

def _validate_env() -> tuple[str, str, str]:
    load_dotenv(".env.local")
    supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    fmp_key      = os.getenv("FMP_API_KEY")

    missing: list[str] = []
    if not supabase_url: missing.append("SUPABASE_URL or VITE_SUPABASE_URL")
    if not supabase_key: missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not fmp_key:      missing.append("FMP_API_KEY")
    if missing:
        raise EnvironmentError(f"Missing env vars: {', '.join(missing)}")

    return supabase_url, supabase_key, fmp_key


# ---------------------------------------------------------------------------
# FMP client (minimal – replicates bootstrap_database.py behaviour)
# ---------------------------------------------------------------------------

class _FMPClient:
    BASE_URL            = "https://financialmodelingprep.com/stable"
    REQUESTS_PER_MINUTE = 250
    MIN_INTERVAL        = 60.0 / REQUESTS_PER_MINUTE
    MAX_RETRIES         = 5
    INITIAL_BACKOFF     = 2.0
    MAX_BACKOFF         = 60.0

    def __init__(self, api_key: str) -> None:
        self.api_key        = api_key
        self._last_request  = 0.0

    def _wait(self) -> None:
        elapsed = time.time() - self._last_request
        if elapsed < self.MIN_INTERVAL:
            time.sleep(self.MIN_INTERVAL - elapsed)
        self._last_request = time.time()

    def _request(self, endpoint: str, params: dict | None = None) -> list | dict:
        if params is None:
            params = {}
        params["apikey"] = self.api_key
        url = f"{self.BASE_URL}/{endpoint}"

        for attempt in range(self.MAX_RETRIES):
            self._wait()
            try:
                resp = requests.get(url, params=params, timeout=30)
                if resp.status_code == 429:
                    backoff = min(self.INITIAL_BACKOFF * (2 ** attempt), self.MAX_BACKOFF)
                    print(f"      [429 rate-limit] sleeping {backoff:.1f}s …")
                    time.sleep(backoff)
                    continue
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.RequestException as exc:
                if attempt < self.MAX_RETRIES - 1:
                    backoff = min(self.INITIAL_BACKOFF * (2 ** attempt), self.MAX_BACKOFF)
                    print(f"      [request error] {exc}  retry in {backoff:.1f}s …")
                    time.sleep(backoff)
                else:
                    raise
        raise RuntimeError(f"FMP request failed after {self.MAX_RETRIES} retries")

    def get_etf_info(self, ticker: str) -> dict | None:
        try:
            data = self._request("etf/info", {"symbol": ticker})
            return data[0] if data else None
        except Exception:
            return None

    def get_historical_prices(self, ticker: str, from_date: str, to_date: str) -> list:
        try:
            data = self._request(
                "historical-price-eod/full",
                {"symbol": ticker, "from": from_date, "to": to_date},
            )
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def get_dividends(self, ticker: str) -> list:
        try:
            data = self._request("dividends", {"symbol": ticker})
            return data if isinstance(data, list) else []
        except Exception:
            return []


# ---------------------------------------------------------------------------
# Price / dividend helpers (same logic as bootstrap_database.py)
# ---------------------------------------------------------------------------

def _find_price_on_date(
    prices: list, target: datetime, lookback_days: int = 7
) -> float | None:
    """Return close price on or before target date within lookback window."""
    target_str = target.strftime("%Y-%m-%d")
    min_str    = (target - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    for row in prices:                    # prices are sorted newest → oldest
        date_str = row.get("date", "")
        if min_str <= date_str <= target_str:
            return row.get("close")
    return None


def _find_earliest_price(prices: list) -> tuple[float | None, str | None]:
    if not prices:
        return None, None
    earliest = prices[-1]                 # newest-first list ⇒ last = oldest
    return earliest.get("close"), earliest.get("date")


def _dividends_in_range(
    dividends: list, start: datetime, end: datetime
) -> float:
    s, e = start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
    total = 0.0
    for div in dividends:
        d = div.get("date", "")
        if s <= d <= e:
            total += div.get("adjDividend", 0) or div.get("dividend", 0) or 0
    return total


# ---------------------------------------------------------------------------
# ROC formula (identical to bootstrap_database.py → estimate_roc_from_nav_erosion)
# ---------------------------------------------------------------------------

def _estimate_roc(
    price_at_inception: float,
    price_at_cutoff: float,
    dividends_since_inception: float,
    years_since_inception: float,
    min_months: int = 2,
) -> float | None:
    """
    Returns ROC % (0–100) or None when data is insufficient.
    Mirrors bootstrap_database.py  estimate_roc_from_nav_erosion exactly.
    """
    if not price_at_inception or not price_at_cutoff:
        return None

    # Fund too new
    if years_since_inception < (min_months / 12):
        return 0.0

    # No dividends → no ROC
    if dividends_since_inception <= 0:
        return 0.0

    price_change = price_at_cutoff - price_at_inception

    if price_change < 0:
        # Case 1: price declined (NAV erosion)
        annual_erosion   = abs(price_change) / years_since_inception
        annual_dividends = dividends_since_inception / years_since_inception
        if annual_dividends > 0:
            return round(min((annual_erosion / annual_dividends) * 100, 100), 2)

    else:
        # Case 2: price up but distributions may exceed gains
        annual_gain      = price_change / years_since_inception
        annual_dividends = dividends_since_inception / years_since_inception
        if annual_dividends > annual_gain:
            shortfall = annual_dividends - annual_gain
            return round(min((shortfall / annual_dividends) * 100, 100), 2)

    # Case 3: fully covered by gains
    return 0.0


# ---------------------------------------------------------------------------
# Month helpers
# ---------------------------------------------------------------------------

def _month_start(year: int, month: int) -> datetime:
    return datetime(year, month, 1)


def _month_end(year: int, month: int) -> datetime:
    """Last calendar day of the given month."""
    if month == 12:
        return datetime(year + 1, 1, 1) - timedelta(days=1)
    return datetime(year, month + 1, 1) - timedelta(days=1)


def _past_months(lookback: int) -> list[tuple[datetime, datetime]]:
    """
    Return list of (month_start, month_end) tuples for the past `lookback`
    months, oldest first, excluding the current (incomplete) month.
    """
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    # Start from the month BEFORE current (last complete month)
    anchor = datetime(today.year, today.month, 1) - timedelta(days=1)
    result: list[tuple[datetime, datetime]] = []

    for _ in range(lookback):
        ms = _month_start(anchor.year, anchor.month)
        me = _month_end(anchor.year, anchor.month)
        result.insert(0, (ms, me))
        anchor = ms - timedelta(days=1)

    return result


# ---------------------------------------------------------------------------
# Main logic
# ---------------------------------------------------------------------------

def _fetch_all_etfs(supabase: Client) -> list[dict]:
    response = (
        supabase.table("etfs")
        .select("id, ticker, inception_date")
        .order("ticker")
        .execute()
    )
    return response.data or []


def seed_monthly_roc(
    lookback_months: int = 18,
    dry_run: bool = False,
    tickers_filter: list[str] | None = None,
) -> None:
    supabase_url, supabase_key, fmp_key = _validate_env()
    supabase: Client = create_client(supabase_url, supabase_key)
    fmp = _FMPClient(fmp_key)

    months = _past_months(lookback_months)
    earliest_cutoff = months[0][0]  # oldest month start we'll need prices for
    today           = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    print("=" * 70)
    print("Seed Monthly ROC History (one-time)")
    print("=" * 70)
    print(f"  Lookback months : {lookback_months}")
    print(f"  Month range     : {months[0][0].strftime('%Y-%m')}  →  {months[-1][0].strftime('%Y-%m')}")
    print(f"  Dry run         : {dry_run}")

    # Fetch ETF list from DB
    all_etfs = _fetch_all_etfs(supabase)
    if tickers_filter:
        tickers_filter_upper = {t.upper() for t in tickers_filter}
        all_etfs = [e for e in all_etfs if e["ticker"] in tickers_filter_upper]

    print(f"  ETFs to process : {len(all_etfs)}")
    print("=" * 70)

    total_rows_written = 0
    skipped_etfs       = 0

    for etf_idx, etf in enumerate(all_etfs, 1):
        ticker    = etf["ticker"]
        ticker_id = etf["id"]
        inception_str = etf.get("inception_date")

        print(f"\n[{etf_idx}/{len(all_etfs)}] {ticker}")

        # Parse inception date
        inception_dt: datetime | None = None
        if inception_str:
            try:
                inception_dt = datetime.strptime(inception_str[:10], "%Y-%m-%d")
            except ValueError:
                pass

        # ------------------------------------------------------------------
        # Fetch historical prices: from ~5 years ago (or inception) to today
        # One call per ticker — reuse across all months
        # ------------------------------------------------------------------
        price_from = max(
            (earliest_cutoff - timedelta(days=30)).strftime("%Y-%m-%d"),
            (inception_dt - timedelta(days=14)).strftime("%Y-%m-%d") if inception_dt else "2015-01-01",
        )
        price_to   = today.strftime("%Y-%m-%d")

        prices    = fmp.get_historical_prices(ticker, from_date=price_from, to_date=price_to)
        dividends = fmp.get_dividends(ticker)

        if not prices:
            print(f"  ⚠  No price data from FMP — skipping")
            skipped_etfs += 1
            continue

        # Resolve inception price (same logic as bootstrap_database.py)
        price_at_inception: float | None = None
        effective_inception: datetime | None = inception_dt

        if inception_dt:
            price_at_inception = _find_price_on_date(prices, inception_dt, lookback_days=14)

        if not price_at_inception:
            ep, ed = _find_earliest_price(prices)
            if ep:
                price_at_inception = ep
                if ed:
                    try:
                        effective_inception = datetime.strptime(ed, "%Y-%m-%d")
                    except ValueError:
                        pass

        if not price_at_inception or not effective_inception:
            print(f"  ⚠  Cannot determine inception price — skipping")
            skipped_etfs += 1
            continue

        # ------------------------------------------------------------------
        # Calculate ROC for each month
        # ------------------------------------------------------------------
        monthly_rows: list[dict] = []

        for month_start, month_end in months:
            # Skip months entirely before inception
            if month_end < effective_inception:
                continue

            # Cutoff = last calendar day of this month (capped at today)
            cutoff = min(month_end, today)

            price_at_cutoff = _find_price_on_date(prices, cutoff, lookback_days=14)
            if not price_at_cutoff:
                print(f"    {month_start.strftime('%Y-%m')}  →  no price at cutoff, skip")
                continue

            years_since = max((cutoff - effective_inception).days / 365.0, 0.0)
            divs_since  = _dividends_in_range(dividends, effective_inception, cutoff)

            roc = _estimate_roc(
                price_at_inception=price_at_inception,
                price_at_cutoff=price_at_cutoff,
                dividends_since_inception=divs_since,
                years_since_inception=years_since,
            )

            month_label = month_start.strftime("%Y-%m")

            if roc is None:
                print(f"    {month_label}  →  ROC=None  (data insufficient, skip)")
                continue

            print(
                f"    {month_label}  |  "
                f"inception_px={price_at_inception:.2f}  "
                f"cutoff_px={price_at_cutoff:.2f}  "
                f"divs={divs_since:.4f}  "
                f"yrs={years_since:.2f}  "
                f"→  ROC={roc:.2f}%"
            )

            monthly_rows.append({
                "ticker_id":              ticker_id,
                "month_start_date":       month_start.strftime("%Y-%m-%d"),
                "roc_percent":            roc,
                "source_week_start_date": cutoff.strftime("%Y-%m-%d"),
            })

        if not monthly_rows:
            print(f"  ○  No monthly rows produced for {ticker}")
            continue

        # ------------------------------------------------------------------
        # Upsert
        # ------------------------------------------------------------------
        if dry_run:
            print(f"  [dry-run] would upsert {len(monthly_rows)} rows for {ticker}")
        else:
            batch_size = 200
            for i in range(0, len(monthly_rows), batch_size):
                batch = monthly_rows[i : i + batch_size]
                result = (
                    supabase.table("etf_monthly_roc")
                    .upsert(batch, on_conflict="ticker_id,month_start_date")
                    .execute()
                )
                if getattr(result, "error", None):
                    print(f"  ✗  Upsert error for {ticker}: {result.error}")
                else:
                    total_rows_written += len(batch)
            print(f"  ✓  {len(monthly_rows)} month(s) upserted for {ticker}")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("DONE")
    print(f"  ETFs processed   : {len(all_etfs) - skipped_etfs}")
    print(f"  ETFs skipped     : {skipped_etfs}")
    print(f"  Total rows written: {total_rows_written}")
    if dry_run:
        print("  (Dry-run — no rows were actually written to DB)")
    print("=" * 70)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="One-time seed of etf_monthly_roc from FMP historical data."
    )
    parser.add_argument(
        "--lookback-months",
        type=int,
        default=18,
        help="Number of complete past months to backfill (default: 18).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute and log ROC but do NOT write to DB.",
    )
    parser.add_argument(
        "--ticker",
        nargs="+",
        metavar="TICKER",
        help="Process only these tickers (default: all ETFs in DB).",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    seed_monthly_roc(
        lookback_months=max(1, args.lookback_months),
        dry_run=args.dry_run,
        tickers_filter=args.ticker,
    )
