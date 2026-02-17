"""
Buy Zone Picks — list ETFs that satisfy the same conditions as the app card.

Conditions (match BuyZonePicksCard.tsx):
  a. Canary Status = Healthy (ROC < 20%)
  b. True Income Yield > 10%
  c. Current Price < 90-day moving average (latest_adj_close < price_avg_90d)
  d. Sort by True Income Yield descending, then ticker
  e. Top 10

Use this to verify which ETFs should appear in the app when the card shows
"No Healthy ETFs with True Yield >10% currently trading below their 90-day average."

Usage:
  python buy_zone_picks_list.py

Requires: .env.local with Supabase URL and service key (project root).
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_INGESTION_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = DATA_INGESTION_DIR.parent
ENV_PATH = PROJECT_ROOT / ".env.local"


def load_dotenv_simple(path: Path) -> None:
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


load_dotenv_simple(ENV_PATH)

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("SUPABASE_KEY")
)

if not SUPABASE_URL:
    raise SystemExit("Missing VITE_SUPABASE_URL or SUPABASE_URL")
if not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Match app constants
TRUE_YIELD_MIN = 10
TOP_N = 10


def main() -> None:
    # Fetch all ETFs with columns needed for filter + display
    result = (
        supabase.table("etfs")
        .select(
            "ticker, name, canary_health, roc_latest, true_income_yield, "
            "latest_adj_close, price_avg_90d"
        )
        .execute()
    )
    rows = result.data or []

    # Apply same filters as BuyZonePicksCard
    filtered = []
    for r in rows:
        if (r.get("canary_health") or "") != "Healthy":
            continue
        true_yield = r.get("true_income_yield")
        if true_yield is None or float(true_yield) <= TRUE_YIELD_MIN:
            continue
        price = r.get("latest_adj_close")
        avg90 = r.get("price_avg_90d")
        if price is None or avg90 is None:
            continue
        try:
            if float(price) >= float(avg90):
                continue
        except (TypeError, ValueError):
            continue
        filtered.append(r)

    # Sort by True Income Yield desc, then ticker (match app)
    def sort_key(row):
        y = row.get("true_income_yield")
        y = float(y) if y is not None else -1.0
        return (-y, (row.get("ticker") or "").lower())

    filtered.sort(key=sort_key)
    top = filtered[:TOP_N]

    # Print report
    print()
    print("=" * 80)
    print("Buy Zone Picks — Undervalued Healthy ETFs (test script)")
    print("=" * 80)
    print("Filters: Healthy (ROC <20%), True Yield >10%, Price < 90d avg. Sorted by True Yield.")
    print("Top 10 (same logic as app; Basic sees top 3, rest blurred; Free sees all blurred).")
    print()

    if not top:
        print("No Healthy ETFs with True Yield >10% currently trading below their 90-day average.")
        print("(Matches app empty state.)")
        print()
        # Show why: counts by filter
        healthy = sum(1 for r in rows if (r.get("canary_health") or "") == "Healthy")
        high_yield = sum(
            1
            for r in rows
            if r.get("true_income_yield") is not None and float(r.get("true_income_yield", 0)) > TRUE_YIELD_MIN
        )
        with_price_avg = sum(1 for r in rows if r.get("price_avg_90d") is not None)
        below_avg = sum(
            1
            for r in rows
            if r.get("latest_adj_close") is not None
            and r.get("price_avg_90d") is not None
            and float(r.get("latest_adj_close", 0)) < float(r.get("price_avg_90d", 0))
        )
        healthy_high = sum(
            1
            for r in rows
            if (r.get("canary_health") or "") == "Healthy"
            and r.get("true_income_yield") is not None
            and float(r.get("true_income_yield", 0)) > TRUE_YIELD_MIN
        )
        print("Debug counts (all ETFs):")
        print(f"  Healthy: {healthy}")
        print(f"  True Yield >10%: {high_yield}")
        print(f"  With 90d avg: {with_price_avg}")
        print(f"  Price < 90d avg: {below_avg}")
        print(f"  Healthy + True Yield >10%: {healthy_high}")
        return

    print(f"{'#':<3} {'Ticker':<8} {'Name':<28} {'Status':<10} {'True %':>8} {'Price':>10} {'90d Avg':>10}")
    print("-" * 80)
    for i, r in enumerate(top, 1):
        ticker = (r.get("ticker") or "")[:8]
        name = (r.get("name") or "")[:28]
        status = (r.get("canary_health") or "")[:10]
        true_pct = r.get("true_income_yield")
        true_str = f"{float(true_pct):.2f}%" if true_pct is not None else "—"
        price = r.get("latest_adj_close")
        price_str = f"${float(price):.2f}" if price is not None else "—"
        avg90 = r.get("price_avg_90d")
        avg_str = f"${float(avg90):.2f}" if avg90 is not None else "—"
        print(f"{i:<3} {ticker:<8} {name:<28} {status:<10} {true_str:>8} {price_str:>10} {avg_str:>10}")
    print("-" * 80)
    print(f"Total satisfying conditions: {len(filtered)} (showing top {len(top)}).")
    print()


if __name__ == "__main__":
    main()
