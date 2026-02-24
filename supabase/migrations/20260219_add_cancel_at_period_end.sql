-- ============================================
-- Migration: Cancel at period end (paid subscriptions)
-- Created: 2026-02-19
-- Purpose: Track when user cancels but keeps access until end of billing period.
-- ============================================

-- User has requested cancellation; access continues until cancels_at.
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- When paid access ends (current_period_end from Stripe when cancel_at_period_end was set).
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancels_at TIMESTAMPTZ;

COMMENT ON COLUMN users.cancel_at_period_end IS 'True when user cancelled a paid subscription; they keep access until cancels_at. Cleared when subscription actually ends (webhook).';
COMMENT ON COLUMN users.cancels_at IS 'End of access when cancel_at_period_end is true (Stripe current_period_end).';

CREATE INDEX IF NOT EXISTS idx_users_cancel_at_period_end
  ON users(cancel_at_period_end)
  WHERE cancel_at_period_end = TRUE;
