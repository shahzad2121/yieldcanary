"""
Monthly ROC snapshot (ongoing) — FMP-only for prices and dividends.

For each ETF in `etfs`, computes NAV-erosion ROC as of the last available
US trading day on or before the calendar last day of a target month, then
upserts one row into `etf_monthly_roc` for that month bucket (month_start_date
= YYYY-MM-01).

Default target month: the **previous** complete calendar month (never the
current incomplete month).

Weekends / holidays: uses the same rule as seed_monthly_roc_history.py — pick
the newest EOD bar in [last_calendar_day - lookback, last_calendar_day].

Usage
-----
From project root:

    python "data ingestion/snapshot_monthly_roc.py"

    python "data ingestion/snapshot_monthly_roc.py" --month 2026-03
    python "data ingestion/snapshot_monthly_roc.py" --dry-run
    python "data ingestion/snapshot_monthly_roc.py" --ticker QQQI

Requirements
------------
    VITE_SUPABASE_URL / SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    FMP_API_KEY
"""

from __future__ import annotations

import argparse
import os
import time
from datetime import datetime, timedelta, timezone
import requests
from dotenv import load_dotenv
from supabase import Client, create_client


def _validate_env() -> tuple[str, str, str]:
    load_dotenv(".env.local")
    supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    fmp_key = os.getenv("FMP_API_KEY")

    missing: list[str] = []
    if not supabase_url:
        missing.append("SUPABASE_URL or VITE_SUPABASE_URL")
    if not supabase_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not fmp_key:
        missing.append("FMP_API_KEY")
    if missing:
        raise EnvironmentError(f"Missing env vars: {', '.join(missing)}")

    return supabase_url, supabase_key, fmp_key


class _FMPClient:
    BASE_URL = "https://financialmodelingprep.com/stable"
    REQUESTS_PER_MINUTE = 250
    MIN_INTERVAL = 60.0 / REQUESTS_PER_MINUTE
    MAX_RETRIES = 5
    INITIAL_BACKOFF = 2.0
    MAX_BACKOFF = 60.0

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self._last_request = 0.0

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
                    backoff = min(self.INITIAL_BACKOFF * (2**attempt), self.MAX_BACKOFF)
                    print(f"      [429 rate-limit] sleeping {backoff:.1f}s …")
                    time.sleep(backoff)
                    continue
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.RequestException as exc:
                if attempt < self.MAX_RETRIES - 1:
                    backoff = min(self.INITIAL_BACKOFF * (2**attempt), self.MAX_BACKOFF)
                    print(f"      [request error] {exc}  retry in {backoff:.1f}s …")
                    time.sleep(backoff)
                else:
                    raise
        raise RuntimeError(f"FMP request failed after {self.MAX_RETRIES} retries")

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


def _month_start(year: int, month: int) -> datetime:
    return datetime(year, month, 1)


def _month_end(year: int, month: int) -> datetime:
    if month == 12:
        return datetime(year + 1, 1, 1) - timedelta(days=1)
    return datetime(year, month + 1, 1) - timedelta(days=1)


def _default_previous_complete_month(now: datetime) -> tuple[int, int]:
    """Calendar month immediately before `now`'s month."""
    first_this = datetime(now.year, now.month, 1)
    last_prev = first_this - timedelta(days=1)
    return last_prev.year, last_prev.month


def _find_last_close_on_or_before(
    prices: list,
    last_calendar_day: datetime,
    lookback_days: int = 14,
) -> tuple[str | None, float | None]:
    """
    Newest-first price list: return (date_str, close) for the latest bar with
    date in [last_calendar_day - lookback_days, last_calendar_day].
    """
    target_str = last_calendar_day.strftime("%Y-%m-%d")
    min_str = (last_calendar_day - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    for row in prices:
        date_str = row.get("date", "")
        if min_str <= date_str <= target_str:
            close = row.get("close")
            if close is not None:
                return date_str, float(close)
    return None, None


def _find_earliest_price(prices: list) -> tuple[float | None, str | None]:
    if not prices:
        return None, None
    earliest = prices[-1]
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


def _find_price_on_date(
    prices: list, target: datetime, lookback_days: int = 14
) -> float | None:
    _, px = _find_last_close_on_or_before(prices, target, lookback_days)
    return px


def _estimate_roc(
    price_at_inception: float,
    price_at_cutoff: float,
    dividends_since_inception: float,
    years_since_inception: float,
    min_months: int = 2,
) -> float | None:
    if not price_at_inception or not price_at_cutoff:
        return None
    if years_since_inception < (min_months / 12):
        return 0.0
    if dividends_since_inception <= 0:
        return 0.0

    price_change = price_at_cutoff - price_at_inception

    if price_change < 0:
        annual_erosion = abs(price_change) / years_since_inception
        annual_dividends = dividends_since_inception / years_since_inception
        if annual_dividends > 0:
            return round(min((annual_erosion / annual_dividends) * 100, 100), 2)
    else:
        annual_gain = price_change / years_since_inception
        annual_dividends = dividends_since_inception / years_since_inception
        if annual_dividends > annual_gain:
            shortfall = annual_dividends - annual_gain
            return round(min((shortfall / annual_dividends) * 100, 100), 2)

    return 0.0


def _fetch_all_etfs(supabase: Client) -> list[dict]:
    response = (
        supabase.table("etfs")
        .select("id, ticker, inception_date")
        .order("ticker")
        .execute()
    )
    return response.data or []


def snapshot_monthly_roc(
    year: int,
    month: int,
    dry_run: bool = False,
    tickers_filter: list[str] | None = None,
    lookback_days: int = 14,
) -> None:
    supabase_url, supabase_key, fmp_key = _validate_env()
    supabase: Client = create_client(supabase_url, supabase_key)
    fmp = _FMPClient(fmp_key)

    now = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=None
    )
    month_start = _month_start(year, month)
    calendar_last = _month_end(year, month)

    print("=" * 70)
    print("Monthly ROC snapshot (FMP)")
    print("=" * 70)
    print(f"  Target month bucket : {month_start.strftime('%Y-%m-%d')} (month_start_date)")
    print(f"  Calendar month end  : {calendar_last.strftime('%Y-%m-%d')}")
    print(f"  Price lookback      : {lookback_days} days (handles weekends/holidays)")
    print(f"  Dry run             : {dry_run}")

    all_etfs = _fetch_all_etfs(supabase)
    if tickers_filter:
        want = {t.upper() for t in tickers_filter}
        all_etfs = [e for e in all_etfs if e["ticker"] in want]

    print(f"  ETFs to process     : {len(all_etfs)}")
    print("=" * 70)

    price_to = calendar_last.strftime("%Y-%m-%d")
    rows_out: list[dict] = []
    skipped = 0

    for idx, etf in enumerate(all_etfs, 1):
        ticker = etf["ticker"]
        ticker_id = etf["id"]
        inception_str = etf.get("inception_date")

        print(f"\n[{idx}/{len(all_etfs)}] {ticker}")

        inception_dt: datetime | None = None
        if inception_str:
            try:
                inception_dt = datetime.strptime(inception_str[:10], "%Y-%m-%d")
            except ValueError:
                pass

        if not inception_dt:
            print("  ⚠  No inception_date in DB — skipping")
            skipped += 1
            continue

        if calendar_last < inception_dt:
            print("  ○  Month ends before inception — skipping")
            skipped += 1
            continue

        price_from = (inception_dt - timedelta(days=30)).strftime("%Y-%m-%d")

        prices = fmp.get_historical_prices(ticker, from_date=price_from, to_date=price_to)
        dividends = fmp.get_dividends(ticker)

        if not prices:
            print("  ⚠  No price data from FMP — skipping")
            skipped += 1
            continue

        price_at_inception = _find_price_on_date(prices, inception_dt, lookback_days=14)
        effective_inception = inception_dt

        if not price_at_inception:
            ep, ed = _find_earliest_price(prices)
            if ep:
                price_at_inception = float(ep)
                if ed:
                    try:
                        effective_inception = datetime.strptime(ed, "%Y-%m-%d")
                    except ValueError:
                        pass

        if not price_at_inception:
            print("  ⚠  Cannot resolve inception price — skipping")
            skipped += 1
            continue

        as_of_date, price_at_cutoff = _find_last_close_on_or_before(
            prices, calendar_last, lookback_days=lookback_days
        )
        if not as_of_date or price_at_cutoff is None:
            print(
                f"  ⚠  No EOD bar on/before {calendar_last.strftime('%Y-%m-%d')} "
                f"(within {lookback_days}d) — skipping"
            )
            skipped += 1
            continue

        cutoff_dt = datetime.strptime(as_of_date, "%Y-%m-%d")
        years_since = max((cutoff_dt - effective_inception).days / 365.0, 0.0)
        divs_since = _dividends_in_range(dividends, effective_inception, cutoff_dt)

        roc = _estimate_roc(
            price_at_inception=price_at_inception,
            price_at_cutoff=price_at_cutoff,
            dividends_since_inception=divs_since,
            years_since_inception=years_since,
        )

        if roc is None:
            print("  ⚠  ROC=None (insufficient data) — skipping")
            skipped += 1
            continue

        print(
            f"  {month_start.strftime('%Y-%m')}  |  as_of={as_of_date}  "
            f"inception_px={price_at_inception:.2f}  cutoff_px={price_at_cutoff:.2f}  "
            f"divs={divs_since:.4f}  yrs={years_since:.2f}  →  ROC={roc:.2f}%"
        )

        rows_out.append(
            {
                "ticker_id": ticker_id,
                "month_start_date": month_start.strftime("%Y-%m-%d"),
                "roc_percent": roc,
                # Actual FMP EOD date used (column name is legacy; value is not ISO week Monday)
                "source_week_start_date": as_of_date,
            }
        )

    if not rows_out:
        print("\nNo rows to upsert.")
        return

    if dry_run:
        print(f"\n[dry-run] Would upsert {len(rows_out)} row(s).")
        return

    batch_size = 500
    total = 0
    for i in range(0, len(rows_out), batch_size):
        batch = rows_out[i : i + batch_size]
        result = (
            supabase.table("etf_monthly_roc")
            .upsert(batch, on_conflict="ticker_id,month_start_date")
            .execute()
        )
        if getattr(result, "error", None):
            raise RuntimeError(f"Upsert error: {result.error}")
        total += len(batch)
        print(f"\n  Upserted batch: {len(batch)} (total {total})")

    print("\n" + "=" * 70)
    print(f"DONE — upserted {total} row(s); skipped {skipped} ETF(s)")
    print("=" * 70)


def _parse_month(s: str) -> tuple[int, int]:
    parts = s.strip().split("-")
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("Expected YYYY-MM")
    y, m = int(parts[0]), int(parts[1])
    if m < 1 or m > 12:
        raise argparse.ArgumentTypeError("Month must be 01-12")
    return y, m


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Upsert one monthly ROC row per ETF (FMP prices/dividends)."
    )
    parser.add_argument(
        "--month",
        type=_parse_month,
        metavar="YYYY-MM",
        help="Target calendar month (default: previous complete month).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute and log only; do not write to DB.",
    )
    parser.add_argument(
        "--ticker",
        nargs="+",
        metavar="TICKER",
        help="Only these tickers (default: all in etfs table).",
    )
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=14,
        help="Days before calendar month-end to search for last EOD bar (default: 14).",
    )
    parser.add_argument(
        "--allow-incomplete-month",
        action="store_true",
        help="Allow targeting the current calendar month (normally blocked).",
    )
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    today_naive = now.replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=None
    )

    if args.month:
        year, month = args.month
    else:
        year, month = _default_previous_complete_month(today_naive)

    # Block writing "current" month unless explicitly allowed (incomplete data)
    cur_y, cur_m = today_naive.year, today_naive.month
    if (year, month) == (cur_y, cur_m) and not args.allow_incomplete_month:
        print(
            "Refusing to snapshot the current calendar month (incomplete). "
            "Use --allow-incomplete-month to override, or omit --month to use "
            "the previous complete month."
        )
        raise SystemExit(1)

    if (year, month) > (cur_y, cur_m):
        print("Target month is in the future — exiting.")
        raise SystemExit(1)

    snapshot_monthly_roc(
        year=year,
        month=month,
        dry_run=args.dry_run,
        tickers_filter=args.ticker,
        lookback_days=max(1, args.lookback_days),
    )


if __name__ == "__main__":
    main()
