"""
Recalculate all ingestion metrics for one or more tickers using LIVE FMP data
and the same pipeline as production (`bootstrap_database.process_etf`).

Use this to debug "why does the UI show X?" without trusting the database row.

Data sources:
- Prices + dividends: FMP (same as bootstrap `process_etf`).
- Weighted 12m ROC: still read from Supabase `etf_monthly_roc` when present
  (same as production). Use --compare-db to see if stored `etfs` disagrees.

Usage (run from repo root recommended):
  python "data ingestion/test-scripts/diagnose_etf_fresh_fmp.py" SPYI
  python "data ingestion/test-scripts/diagnose_etf_fresh_fmp.py" QQQI IWMI
  python "data ingestion/test-scripts/diagnose_etf_fresh_fmp.py" SPYI --compare-db

Requires: `.env.local` at project root with FMP_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
          VITE_SUPABASE_URL or SUPABASE_URL.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

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
            if key and key not in os.environ:
                os.environ[key] = value


def _fmt_pct(x: Any) -> str:
    if x is None:
        return "—"
    return f"{float(x):.2f}%"


def _death_clock_ui(d: dict) -> str:
    if d.get("is_tax_efficient_roc"):
        return "N/A"
    dc = d.get("death_clock_years")
    if dc is None:
        return "N/A"
    return f"{float(dc):.1f} years"


def _distribution_stability_ratio(d: dict) -> float | None:
    a6 = d.get("avg_distribution_6m")
    a12 = d.get("avg_distribution_12m")
    if a6 is None or a12 is None:
        return None
    try:
        a6f = float(a6)
        a12f = float(a12)
    except (TypeError, ValueError):
        return None
    if a12f <= 0:
        return None
    return abs(a6f - a12f) / a12f


def _print_tax_efficient_gates(d: dict) -> None:
    eff = d.get("effective_roc")
    tr1y = d.get("total_return_1y")
    a6 = d.get("avg_distribution_6m")
    a12 = d.get("avg_distribution_12m")

    g1 = eff is not None and float(eff) >= 55
    g2 = tr1y is not None and float(tr1y) >= -5.0
    stab = _distribution_stability_ratio(d)
    g3 = stab is not None and stab <= 0.25

    print("  Tax-Efficient ROC gates (all must pass):")
    print(f"    [1] effective_roc >= 55     → {g1}  (effective_roc={_fmt_pct(eff)})")
    print(f"    [2] total_return_1y >= -5   → {g2}  (total_return_1y={_fmt_pct(tr1y)})")
    if stab is not None:
        print(
            f"    [3] |avg6-avg12|/avg12<=0.25 → {g3}  (ratio={stab:.4f}, avg6={a6}, avg12={a12})"
        )
    else:
        print(f"    [3] distribution stability    → {g3}  (avg6={a6}, avg12={a12})")
    print(f"    → is_tax_efficient_roc (computed) = {d.get('is_tax_efficient_roc')}")
    print("")

    # Client-described check from current discussion:
    # raw ROC + 1Y return + stable distributions.
    roc_raw = d.get("roc_latest")
    tr_1y = d.get("total_return_1y")
    c1 = roc_raw is not None and float(roc_raw) >= 55.0
    c2 = tr_1y is not None and float(tr_1y) >= 0.0
    c3 = stab is not None and stab <= 0.25
    client_badge = c1 and c2 and c3
    print("  Client-described check (diagnostic only, not production logic):")
    print(f"    [1] roc_latest >= 55        → {c1}  (roc_latest={_fmt_pct(roc_raw)})")
    print(f"    [2] total_return_1y >= 0    → {c2}  (total_return_1y={_fmt_pct(tr_1y)})")
    if stab is not None:
        print(
            f"    [3] |avg6-avg12|/avg12<=0.25 → {c3}  (ratio={stab:.4f}, avg6={a6}, avg12={a12})"
        )
    else:
        print(f"    [3] distribution stability    → {c3}  (avg6={a6}, avg12={a12})")
    print(f"    → client_style_badge = {client_badge}")


def _print_report(ticker: str, d: dict) -> None:
    print("\n" + "=" * 72)
    print(f" TICKER: {ticker.upper()}")
    print("=" * 72)

    print("\n--- Identity ---")
    print(f"  name:              {d.get('name')}")
    print(f"  inception_date:    {d.get('inception_date')}")
    print(f"  latest_adj_close:  {d.get('latest_adj_close')}  (as of {d.get('latest_date')})")

    print("\n--- ROC chain (same as bootstrap) ---")
    print(f"  roc_latest (NAV model):     {_fmt_pct(d.get('roc_latest'))}")
    print(f"  weighted_avg_roc_12m (DB):  {d.get('_weighted_avg_roc_12m')}")
    print(f"  roc_source:                 {d.get('_roc_source')}")
    tr1y = d.get("total_return_1y")
    # Same rule as bootstrap_database.calculate_nav_trend_factor
    if tr1y is None:
        nav = 1.0
    else:
        nav = 0.5 if float(tr1y) >= 0 else 1.0
    print(f"  nav_trend_factor:           {nav}  (0.5 if 1Y>=0 else 1.0; missing→1.0)")
    print(f"  effective_roc (stored key): {_fmt_pct(d.get('effective_roc'))}")

    print("\n--- Yields ---")
    print(f"  headline_yield_ttm:  {_fmt_pct(d.get('headline_yield_ttm'))}")
    print(f"  true_income_yield:   {_fmt_pct(d.get('true_income_yield'))}  (= headline × (1 - roc_latest/100))")

    print("\n--- Returns (price, %) ---")
    print(f"  total_return_1y:        {_fmt_pct(d.get('total_return_1y'))}")
    print(f"  total_return_ytd:       {_fmt_pct(d.get('total_return_ytd'))}")
    print(f"  total_return_inception: {_fmt_pct(d.get('total_return_inception'))}")

    print("\n--- Distributions (FMP sums in process_etf) ---")
    print(f"  dividends_last_12mo:    {d.get('dividends_last_12mo')}")
    print(f"  avg_distribution_6m:    {d.get('avg_distribution_6m')}  (sum_6m/6)")
    print(f"  avg_distribution_12m:   {d.get('avg_distribution_12m')}  (sum_12m/12)")

    print("\n--- Canary / Death clock (as stored + UI-style) ---")
    print(f"  canary_health:       {d.get('canary_health')}")
    print(f"  death_clock_years:   {d.get('death_clock_years')}")
    print(f"  death_clock (UI str): {_death_clock_ui(d)}")

    _print_tax_efficient_gates(d)

    print("\n--- Frontend-facing summary (matches mapping in useETFs / table) ---")
    print(f"  canaryStatus:        {d.get('canary_health')}")
    print(f"  deathClock:          {_death_clock_ui(d)}")
    print(f"  isTaxEfficientRoc:   {d.get('is_tax_efficient_roc')}")
    print(f"  headlineYieldTTM:    {d.get('headline_yield_ttm')}")
    print(f"  trueIncomeYield:     {d.get('true_income_yield')}")
    print(f"  rocPercent (UI):     {d.get('roc_latest')}")
    print(f"  totalReturn1Y:       {d.get('total_return_1y')}")
    print(f"  totalReturnYTD:      {d.get('total_return_ytd')}")

    print("\n--- Raw JSON (DB upsert shape, no leading _) ---")
    db_row = {k: v for k, v in d.items() if not str(k).startswith("_")}
    # Drop None-only noise for readability
    print(json.dumps(db_row, indent=2, default=str))


def _compare_db(ticker: str, fresh: dict) -> None:
    try:
        from supabase import create_client
    except ImportError:
        print("  (skip compare-db: supabase not installed)")
        return

    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_KEY")
    )
    if not url or not key:
        print("  (skip compare-db: missing Supabase env)")
        return

    client = create_client(url, key)
    r = (
        client.table("etfs")
        .select(
            "ticker,canary_health,death_clock_years,roc_latest,effective_roc,"
            "total_return_1y,total_return_ytd,headline_yield_ttm,true_income_yield,"
            "is_tax_efficient_roc,avg_distribution_6m,avg_distribution_12m,updated_at"
        )
        .eq("ticker", ticker.upper().strip())
        .maybe_single()
        .execute()
    )
    row = r.data
    if not row:
        print(f"\n--- DB compare ---\n  No row in `etfs` for {ticker.upper()}")
        return

    keys = [
        ("canary_health", "canary_health"),
        ("death_clock_years", "death_clock_years"),
        ("roc_latest", "roc_latest"),
        ("effective_roc", "effective_roc"),
        ("total_return_1y", "total_return_1y"),
        ("total_return_ytd", "total_return_ytd"),
        ("headline_yield_ttm", "headline_yield_ttm"),
        ("true_income_yield", "true_income_yield"),
        ("is_tax_efficient_roc", "is_tax_efficient_roc"),
        ("avg_distribution_6m", "avg_distribution_6m"),
        ("avg_distribution_12m", "avg_distribution_12m"),
    ]
    print("\n--- DB vs fresh FMP pipeline ---")
    print(f"  etfs.updated_at: {row.get('updated_at')}")
    for fk, bk in keys:
        fv = fresh.get(fk)
        bv = row.get(bk)
        match = "==" if fv == bv or (fv is not None and bv is not None and float(fv) == float(bv)) else "!="
        # float compare loose for decimals
        try:
            if fv is not None and bv is not None:
                match = "==" if abs(float(fv) - float(bv)) < 1e-4 else "!="
        except (TypeError, ValueError):
            match = "==" if fv == bv else "!="
        print(f"  {bk:22} DB={bv}  fresh={fv}  {match}")


def main() -> None:
    load_dotenv(ENV_PATH)
    os.chdir(PROJECT_ROOT)
    sys.path.insert(0, str(DATA_INGESTION_DIR))

    parser = argparse.ArgumentParser(description="Diagnose ETF metrics via process_etf (FMP + DB weighted ROC).")
    parser.add_argument("tickers", nargs="+", help="Ticker symbol(s), e.g. SPYI QQQI")
    parser.add_argument(
        "--compare-db",
        action="store_true",
        help="Diff key `etfs` columns vs this fresh run.",
    )
    args = parser.parse_args()

    import bootstrap_database as bd

    fmp = bd.FMPClient(bd.FMP_API_KEY)

    for raw in args.tickers:
        t = raw.strip().upper()
        if not t:
            continue
        print(f"\n>>> Running process_etf({t!r}) …")
        data = bd.process_etf(t, fmp)
        if data is None:
            print(f"  SKIP: process_etf returned None (validation failed / no data).")
            continue
        _print_report(t, data)
        if args.compare_db:
            _compare_db(t, data)

    print("\nDone.\n")


if __name__ == "__main__":
    main()
