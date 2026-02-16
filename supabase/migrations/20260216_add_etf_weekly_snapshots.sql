-- Create table to store weekly snapshots of key ETF metrics
-- Used for "Biggest Movers of the Week" insights.

CREATE TABLE IF NOT EXISTS public.etf_weekly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_id UUID NOT NULL REFERENCES public.etfs(id) ON DELETE CASCADE,

  -- Week marker (e.g. Monday of that week, or any canonical week start)
  week_start_date DATE NOT NULL,

  -- Snapshotted metrics (copied from etfs at snapshot time)
  roc_percent NUMERIC(5,2),           -- copy of etfs.roc_latest
  death_clock_years NUMERIC(10,2),    -- copy of etfs.death_clock_years
  true_income_yield NUMERIC(10,6),    -- copy of etfs.true_income_yield
  headline_yield_ttm NUMERIC(10,6),   -- optional: copy of etfs.headline_yield_ttm
  canary_health VARCHAR(20),          -- optional: 'Healthy' | 'Dying' | 'Dead'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT etf_weekly_snapshots_unique_week
    UNIQUE (ticker_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_etf_weekly_snapshots_ticker_week
  ON public.etf_weekly_snapshots (ticker_id, week_start_date DESC);

