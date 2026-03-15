-- Add description and website for Strategy & Objective (from FMP etf/info).

ALTER TABLE etfs
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;

COMMENT ON COLUMN etfs.description IS 'Fund strategy/objective text from FMP etf/info.';
COMMENT ON COLUMN etfs.website IS 'Official fund or issuer page URL from FMP etf/info (e.g. fact sheet).';
