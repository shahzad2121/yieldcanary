"""
One-time backfill for Tax-Efficient ROC fields on `etfs`.

What it does:
- Computes and fills only missing values for:
  - effective_roc
  - avg_distribution_6m
  - avg_distribution_12m
- Recomputes `is_tax_efficient_roc` and updates when changed.
- If badge is true, sets death_clock_years = NULL (N/A rule).

Data sources:
- Primary: existing Supabase data (`weekly_data`, `etf_monthly_roc`, `etfs`)
- Fallback: FMP dividends API only when 6m/12m averages are missing and
  weekly_data is insufficient.

Usage:
  python "data ingestion/test-scripts/backfill_tax_efficient_roc_fields.py" --dry-run
  python "data ingestion/test-scripts/backfill_tax_efficient_roc_fields.py"
  python "data ingestion/test-scripts/backfill_tax_efficient_roc_fields.py" --tickers QQQI,SPYI --dry-run
"""

from __future__ import annotations

import argparse
import os
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import requests
from supabase import Client, create_client


SCRIPT_DIR = Path(__file__).resolve().parent
DATA_INGESTION_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = DATA_INGESTION_DIR.parent
ENV_PATH = PROJECT_ROOT / ".env.local"
FMP_BASE_URL = "https://financialmodelingprep.com/stable"


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
            if key and key not in os.environ:
                os.environ[key] = value


load_dotenv(ENV_PATH)

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("SUPABASE_KEY")
)
FMP_API_KEY = os.getenv("FMP_API_KEY")

if not SUPABASE_URL:
    raise EnvironmentError("Missing VITE_SUPABASE_URL or SUPABASE_URL")
if not SUPABASE_KEY:
    raise EnvironmentError("Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY/SUPABASE_KEY)")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


class FMPClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._last_request = 0.0
        self._min_interval = 60.0 / 250.0

    def _wait(self) -> None:
        elapsed = time.time() - self._last_request
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_request = time.time()

    def _request(self, endpoint: str, params: dict | None = None):
        if params is None:
            params = {}
        params["apikey"] = self.api_key
        self._wait()
        resp = requests.get(f"{FMP_BASE_URL}/{endpoint}", params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def get_dividends(self, ticker: str) -> list[dict]:
        data = self._request("dividends", {"symbol": ticker})
        return data if isinstance(data, list) else []


def round6(value: float) -> float:
    return round(value, 6)


def calculate_nav_trend_factor(total_return_1y: Optional[float]) -> float:
    if total_return_1y is None:
        return 1.0
    return 0.5 if total_return_1y >= 0 else 1.0


def calculate_effective_roc(
    roc_percent: Optional[float],
    nav_trend_factor: float,
    floor_pct: float = 5.0,
    cap_pct: float = 100.0,
) -> Optional[float]:
    if roc_percent is None or roc_percent <= 0:
        return None
    raw = roc_percent * nav_trend_factor
    return round(max(floor_pct, min(cap_pct, raw)), 2)


def calculate_tax_efficient_roc_badge(
    effective_roc: Optional[float],
    total_return_1y: Optional[float],
    avg_distribution_6m: Optional[float],
    avg_distribution_12m: Optional[float],
) -> bool:
    if effective_roc is None or total_return_1y is None:
        return False
    if avg_distribution_6m is None or avg_distribution_12m is None:
        return False
    if avg_distribution_12m <= 0:
        return False
    stability = abs(avg_distribution_6m - avg_distribution_12m) / avg_distribution_12m
    return (
        effective_roc >= 55
        and total_return_1y >= -5
        and stability <= 0.25
    )


def calculate_weighted_avg_roc_12m_by_id(
    ticker_id: str,
    min_months: int = 3,
) -> Optional[float]:
    full_weights = [0.4, 0.25, 0.15] + [0.2 / 9] * 9
    rows = (
        supabase.table("etf_monthly_roc")
        .select("roc_percent,month_start_date")
        .eq("ticker_id", ticker_id)
        .order("month_start_date", desc=True)
        .limit(12)
        .execute()
    ).data or []
    n = len(rows)
    if n < min_months:
        return None
    values: list[float] = []
    for row in rows:
        roc = row.get("roc_percent")
        if roc is None:
            return None
        values.append(float(roc))
    used_weights = full_weights[:n]
    weight_sum = sum(used_weights)
    norm = [w / weight_sum for w in used_weights]
    return round(sum(v * w for v, w in zip(values, norm)), 2)


def sum_weekly_dividends(
    ticker_id: str,
    start_str: str,
    end_str: str,
) -> Optional[float]:
    rows = (
        supabase.table("weekly_data")
        .select("date,dividend")
        .eq("ticker_id", ticker_id)
        .gte("date", start_str)
        .lte("date", end_str)
        .order("date", desc=True)
        .execute()
    ).data or []
    if not rows:
        return None
    total = 0.0
    has_any = False
    for row in rows:
        div = row.get("dividend")
        if div is None:
            continue
        has_any = True
        total += float(div)
    return total if has_any else 0.0


def sum_fmp_dividends_in_range(
    fmp: FMPClient,
    ticker: str,
    start_str: str,
    end_str: str,
) -> Optional[float]:
    dividends = fmp.get_dividends(ticker)
    if not dividends:
        return None
    total = 0.0
    has_any = False
    for row in dividends:
        date_str = row.get("date", "")
        if start_str <= date_str <= end_str:
            has_any = True
            total += float(row.get("adjDividend", 0) or row.get("dividend", 0) or 0)
    return total if has_any else 0.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill Tax-Efficient ROC fields.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute and print updates without writing to DB.",
    )
    parser.add_argument(
        "--tickers",
        type=str,
        default="",
        help="Comma-separated ticker filter (e.g. QQQI,SPYI).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ticker_filter = {t.strip().upper() for t in args.tickers.split(",") if t.strip()}
    fmp = FMPClient(FMP_API_KEY) if FMP_API_KEY else None

    today = datetime.now().date()
    start_6m = (today - timedelta(days=182)).strftime("%Y-%m-%d")
    start_12m = (today - timedelta(days=365)).strftime("%Y-%m-%d")
    end_str = today.strftime("%Y-%m-%d")

    rows = (
        supabase.table("etfs")
        .select(
            "id,ticker,roc_latest,total_return_1y,effective_roc,avg_distribution_6m,"
            "avg_distribution_12m,is_tax_efficient_roc,death_clock_years"
        )
        .order("ticker", desc=False)
        .execute()
    ).data or []

    if ticker_filter:
        rows = [r for r in rows if (r.get("ticker") or "").upper() in ticker_filter]

    print(f"Scanning {len(rows)} ETFs (dry_run={args.dry_run})")
    if not rows:
        return

    updated = 0
    skipped = 0
    fmp_used = 0

    for row in rows:
        ticker_id = row["id"]
        ticker = row["ticker"]
        total_return_1y = row.get("total_return_1y")
        roc_latest = row.get("roc_latest")

        effective_roc = row.get("effective_roc")
        avg6 = row.get("avg_distribution_6m")
        avg12 = row.get("avg_distribution_12m")
        current_badge = bool(row.get("is_tax_efficient_roc"))
        current_death_clock = row.get("death_clock_years")

        payload: dict = {}

        if effective_roc is None:
            weighted = calculate_weighted_avg_roc_12m_by_id(ticker_id)
            roc_for_risk = weighted if weighted is not None else roc_latest
            nav_factor = calculate_nav_trend_factor(total_return_1y)
            computed_effective = calculate_effective_roc(roc_for_risk, nav_factor)
            if computed_effective is not None:
                effective_roc = computed_effective
                payload["effective_roc"] = computed_effective

        if avg6 is None:
            total_6m = sum_weekly_dividends(ticker_id, start_6m, end_str)
            if total_6m is None and fmp is not None:
                total_6m = sum_fmp_dividends_in_range(fmp, ticker, start_6m, end_str)
                fmp_used += 1
            if total_6m is not None:
                avg6 = round6(total_6m / 6.0)
                payload["avg_distribution_6m"] = avg6

        if avg12 is None:
            total_12m = sum_weekly_dividends(ticker_id, start_12m, end_str)
            if total_12m is None and fmp is not None:
                total_12m = sum_fmp_dividends_in_range(fmp, ticker, start_12m, end_str)
                fmp_used += 1
            if total_12m is not None:
                avg12 = round6(total_12m / 12.0)
                payload["avg_distribution_12m"] = avg12

        new_badge = calculate_tax_efficient_roc_badge(
            effective_roc=effective_roc,
            total_return_1y=total_return_1y,
            avg_distribution_6m=avg6,
            avg_distribution_12m=avg12,
        )
        if new_badge != current_badge:
            payload["is_tax_efficient_roc"] = new_badge

        if new_badge and current_death_clock is not None:
            payload["death_clock_years"] = None

        if not payload:
            skipped += 1
            continue

        if args.dry_run:
            print(f"DRY {ticker}: {payload}")
        else:
            supabase.table("etfs").update(payload).eq("id", ticker_id).execute()
            print(f"UPD {ticker}: {payload}")
        updated += 1

    print("\nDone.")
    print(f"Updated: {updated}")
    print(f"Skipped (no change): {skipped}")
    print(f"FMP fallback calls used: {fmp_used}")
    if fmp is None:
        print("Note: FMP_API_KEY missing. Fallback to FMP was disabled.")


if __name__ == "__main__":
    main()
