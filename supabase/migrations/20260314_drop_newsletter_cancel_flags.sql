-- ============================================
-- Migration: Drop newsletter cancel-at-period-end flags
-- Created: 2026-03-14
-- Purpose: We now cancel newsletter subscriptions immediately instead of
--          scheduling cancel at period end, so these columns are no longer used.
-- ============================================

ALTER TABLE users
  DROP COLUMN IF EXISTS newsletter_cancel_at_period_end,
  DROP COLUMN IF EXISTS newsletter_cancels_at;

DROP INDEX IF EXISTS idx_users_newsletter_cancel_at_period_end;

