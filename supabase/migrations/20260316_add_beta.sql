-- Add beta column to etfs (vs benchmark, from FMP profile).
-- Populated by bootstrap and one-time backfill for existing rows.

ALTER TABLE etfs
ADD COLUMN IF NOT EXISTS beta REAL;

COMMENT ON COLUMN etfs.beta IS 'Beta vs benchmark from FMP profile (e.g. 0.64).';
