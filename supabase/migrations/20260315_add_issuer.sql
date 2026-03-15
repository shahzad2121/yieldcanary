-- Add issuer column to etfs (fund company, e.g. YieldMax, Global X).
-- Populated from FMP etf/info etfCompany; backfill via one-time script.

ALTER TABLE etfs
ADD COLUMN IF NOT EXISTS issuer TEXT;

COMMENT ON COLUMN etfs.issuer IS 'Fund company / issuer from FMP etf/info etfCompany (e.g. YieldMax, Global X).';
