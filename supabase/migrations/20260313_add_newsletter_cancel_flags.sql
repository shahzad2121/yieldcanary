-- ============================================
-- Migration: Newsletter cancel-at-period-end flags
-- Created: 2026-03-13
-- Purpose: Track when a user's paid newsletter is set to cancel at period end,
--          mirroring cancel_at_period_end / cancels_at for the main app subscription.
-- ============================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS newsletter_cancel_at_period_end BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS newsletter_cancels_at TIMESTAMPTZ;

COMMENT ON COLUMN users.newsletter_cancel_at_period_end IS
  'True when newsletter subscription is scheduled to cancel at period end (Stripe cancel_at_period_end).';

COMMENT ON COLUMN users.newsletter_cancels_at IS
  'When newsletter access ends after a scheduled cancel (Stripe current_period_end mapped to timestamp).';

CREATE INDEX IF NOT EXISTS idx_users_newsletter_cancel_at_period_end
  ON users(newsletter_cancel_at_period_end)
  WHERE newsletter_cancel_at_period_end = TRUE;

