-- Lifetime flag: once true, checkout must not attach Stripe trial_period_days again (7d or 30d affiliate).
-- No backfill: existing rows default to false until a trialing subscription sets it via webhook.

ALTER TABLE users ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN users.has_used_trial IS 'True after the user has ever started a subscription in trialing state (standard or affiliate trial). Used to prevent repeat free trials.';
