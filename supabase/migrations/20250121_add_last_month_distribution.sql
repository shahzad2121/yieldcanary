-- Add last_month_distribution column to etfs table
-- This stores the most recent complete calendar month's distribution amount per share (raw, before taxes)
ALTER TABLE etfs 
ADD COLUMN IF NOT EXISTS last_month_distribution NUMERIC(10, 4);

COMMENT ON COLUMN etfs.last_month_distribution IS 
'Most recent complete calendar month distribution amount per share (raw, before taxes). Used to calculate Monthly Spendable Cash Yield on frontend with user tax rate.';

