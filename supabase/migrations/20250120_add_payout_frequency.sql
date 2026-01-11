-- Add payout_frequency column to etfs table
-- This column indicates how often the ETF pays distributions: Weekly, Monthly, or Quarterly

ALTER TABLE etfs 
ADD COLUMN IF NOT EXISTS payout_frequency VARCHAR(20) CHECK (payout_frequency IN ('Weekly', 'Monthly', 'Quarterly') OR payout_frequency IS NULL);

-- Add comment for documentation
COMMENT ON COLUMN etfs.payout_frequency IS 'Distribution frequency: Weekly, Monthly, or Quarterly';

