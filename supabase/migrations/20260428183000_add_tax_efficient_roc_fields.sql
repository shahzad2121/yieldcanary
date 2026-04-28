-- Add fields for Tax-Efficient ROC badge workflow.
-- Safe additive migration only: no drops, no rewrites, no backfill.
-- Existing ingestion/UI continues to work until these fields are populated.

ALTER TABLE public.etfs
ADD COLUMN IF NOT EXISTS effective_roc NUMERIC(10, 6);

ALTER TABLE public.etfs
ADD COLUMN IF NOT EXISTS avg_distribution_6m NUMERIC(12, 6);

ALTER TABLE public.etfs
ADD COLUMN IF NOT EXISTS avg_distribution_12m NUMERIC(12, 6);

ALTER TABLE public.etfs
ADD COLUMN IF NOT EXISTS is_tax_efficient_roc BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.etfs.effective_roc IS
'Effective ROC (%) derived by ingestion logic (ROC adjusted by NAV trend factor with guardrails).';

COMMENT ON COLUMN public.etfs.avg_distribution_6m IS
'Average per-share distribution over the trailing 6-month window used for tax-efficient ROC stability checks.';

COMMENT ON COLUMN public.etfs.avg_distribution_12m IS
'Average per-share distribution over the trailing 12-month window used for tax-efficient ROC stability checks.';

COMMENT ON COLUMN public.etfs.is_tax_efficient_roc IS
'True when ETF meets Tax-Efficient ROC badge criteria. Defaults to false until computed by ingestion.';
