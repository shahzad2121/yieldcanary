-- Add price_avg_90d column to etfs table
-- 90-day (trailing) average of adj_close from weekly_data. NULL when insufficient history.

ALTER TABLE etfs
ADD COLUMN IF NOT EXISTS price_avg_90d NUMERIC(10, 4);

COMMENT ON COLUMN etfs.price_avg_90d IS
'Trailing 90-day average closing price (from weekly_data). Used for Buy Zone filter: price < 90d avg. NULL when fewer than ~90 days of data.';
