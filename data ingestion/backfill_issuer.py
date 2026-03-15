"""
One-time backfill: populate etfs.issuer from FMP etf/info etfCompany.

Run after applying the migration that adds the issuer column.
Only updates the issuer column; does not change any other etfs fields.

Usage (from repo root or from data ingestion/):
  python "data ingestion/backfill_issuer.py"

Requires: .env.local with FMP_API_KEY, VITE_SUPABASE_URL (or SUPABASE_URL),
          SUPABASE_SERVICE_ROLE_KEY.
"""

import os
import time
from typing import Optional
import requests
from dotenv import load_dotenv
from supabase import create_client, Client

# Load env (project root or data ingestion)
load_dotenv(".env.local")
load_dotenv("../.env.local")

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
FMP_API_KEY = os.getenv("FMP_API_KEY")
FMP_BASE_URL = "https://financialmodelingprep.com/stable"
MIN_INTERVAL = 60.0 / 300  # 300 req/min


def get_etf_company(ticker: str) -> Optional[str]:
    """Fetch etf/info for ticker; return etfCompany or None."""
    url = f"{FMP_BASE_URL}/etf/info"
    params = {"symbol": ticker, "apikey": FMP_API_KEY}
    try:
        time.sleep(MIN_INTERVAL)
        r = requests.get(url, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list) and len(data) > 0:
            return data[0].get("etfCompany") or None
    except Exception as e:
        print(f"  FMP error for {ticker}: {e}")
    return None


def main() -> None:
    if not all([SUPABASE_URL, SUPABASE_KEY, FMP_API_KEY]):
        print("Missing env: set VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FMP_API_KEY")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("Fetching tickers from etfs...")
    res = supabase.table("etfs").select("ticker").execute()
    rows = res.data or []
    tickers = [r["ticker"] for r in rows if r.get("ticker")]
    print(f"Found {len(tickers)} ETFs.\n")

    updated = 0
    skipped = 0
    failed = 0

    for i, ticker in enumerate(tickers, 1):
        issuer = get_etf_company(ticker)
        if issuer is None or issuer == "":
            print(f"[{i}/{len(tickers)}] {ticker}: no etfCompany — skip")
            skipped += 1
            continue
        try:
            supabase.table("etfs").update({"issuer": issuer}).eq("ticker", ticker).execute()
            print(f"[{i}/{len(tickers)}] {ticker}: issuer={issuer}")
            updated += 1
        except Exception as e:
            print(f"[{i}/{len(tickers)}] {ticker}: update failed — {e}")
            failed += 1

    print(f"\nDone: updated={updated}, skipped={skipped}, failed={failed}")


if __name__ == "__main__":
    main()
