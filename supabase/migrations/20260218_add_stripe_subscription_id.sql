-- ============================================
-- Migration: Store Stripe subscription ID on users
-- Created: 2026-02-18
-- Purpose: Persist subscription id (sub_xxx) so cancel flow can cancel directly without listing.
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

COMMENT ON COLUMN users.stripe_subscription_id IS 'Stripe subscription ID (sub_xxx). Set by webhook on subscription created/updated; cleared on cancel. Used by in-app cancel to call Stripe cancel directly.';

CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
