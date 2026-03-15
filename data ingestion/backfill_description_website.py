"""
One-time backfill: populate etfs.description and etfs.website from FMP etf/info.

Run after applying the migration that adds description and website columns.
Only updates these two columns.

Usage (from repo root or from data ingestion/):
  python "data ingestion/backfill_description_website.py"

Requires: .env.local with FMP_API_KEY, VITE_SUPABASE_URL (or SUPABASE_URL),
          SUPABASE_SERVICE_ROLE_KEY.
"""

import os
import time
from typing import Optional, Tuple
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


def get_description_and_website(ticker: str) -> Tuple[Optional[str], Optional[str]]:
    """Fetch etf/info for ticker; return (description, website). Either may be None."""
    url = f"{FMP_BASE_URL}/etf/info"
    params = {"symbol": ticker, "apikey": FMP_API_KEY}
    try:
        time.sleep(MIN_INTERVAL)
        r = requests.get(url, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        if not isinstance(data, list) or len(data) == 0:
            return None, None
        row = data[0]
        desc = row.get("description")
        web = row.get("website")
        if desc is not None and isinstance(desc, str) and desc.strip():
            desc = desc.strip()
        else:
            desc = None
        if web is not None and isinstance(web, str) and web.strip():
            web = web.strip()
        else:
            web = None
        return desc, web
    except Exception as e:
        print(f"  FMP error for {ticker}: {e}")
    return None, None


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
    failed = 0

    for i, ticker in enumerate(tickers, 1):
        description, website = get_description_and_website(ticker)
        try:
            supabase.table("etfs").update({
                "description": description,
                "website": website,
            }).eq("ticker", ticker).execute()
            desc_preview = (description[:40] + "…") if description and len(description) > 40 else (description or "—")
            print(f"[{i}/{len(tickers)}] {ticker}: desc={desc_preview}  web={website or '—'}")
            updated += 1
        except Exception as e:
            print(f"[{i}/{len(tickers)}] {ticker}: update failed — {e}")
            failed += 1

    print(f"\nDone: updated={updated}, failed={failed}")


if __name__ == "__main__":
    main()
