-- Monthly ROC snapshot table
-- Stores one ROC point per ETF per calendar month.
-- Populated from the weekly snapshot pipeline by upserting the latest
-- available weekly value into that month bucket.

CREATE TABLE IF NOT EXISTS public.etf_monthly_roc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_id UUID NOT NULL REFERENCES public.etfs(id) ON DELETE CASCADE,
  month_start_date DATE NOT NULL,              -- canonical YYYY-MM-01
  roc_percent NUMERIC(5,2),                    -- monthly ROC %
  source_week_start_date DATE,                 -- weekly snapshot date used
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT etf_monthly_roc_unique_month UNIQUE (ticker_id, month_start_date),
  CONSTRAINT etf_monthly_roc_positive CHECK (roc_percent IS NULL OR (roc_percent >= 0 AND roc_percent <= 100))
);

CREATE INDEX IF NOT EXISTS idx_etf_monthly_roc_ticker_month
  ON public.etf_monthly_roc (ticker_id, month_start_date DESC);

