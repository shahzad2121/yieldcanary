-- Add advertised_yield column to etfs table
-- (latest payout per share × annualization factor) / latest_adj_close × 100
-- NULL when payout_frequency or last payout or price is missing

ALTER TABLE etfs
ADD COLUMN IF NOT EXISTS advertised_yield NUMERIC(10, 6);

COMMENT ON COLUMN etfs.advertised_yield IS
'Advertised yield: (last payout per share × annualization) / latest price × 100. NULL when insufficient data (no payout_frequency, no recent dividend, or no price).';
