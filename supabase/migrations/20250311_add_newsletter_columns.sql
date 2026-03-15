-- ============================================
-- Migration: Newsletter subscription on users
-- Created: 2026-03-11
-- Purpose: Track paid newsletter tier (none/monthly/yearly) and Stripe subscription for cancel flow.
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_tier VARCHAR(32) DEFAULT 'none';

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_newsletter_subscription_id VARCHAR(255);

COMMENT ON COLUMN users.newsletter_tier IS 'Paid newsletter: none (free/cancelled), monthly ($5/mo), yearly ($49/yr). Used to decide who receives weekly newsletter and for UI.';
COMMENT ON COLUMN users.stripe_newsletter_subscription_id IS 'Stripe subscription ID (sub_xxx) for newsletter. Set by webhook on payment success; cleared on cancel. Used by in-app cancel to call Stripe cancel.';

CREATE INDEX IF NOT EXISTS idx_users_newsletter_tier ON users(newsletter_tier) WHERE newsletter_tier != 'none';
CREATE INDEX IF NOT EXISTS idx_users_stripe_newsletter_subscription_id ON users(stripe_newsletter_subscription_id) WHERE stripe_newsletter_subscription_id IS NOT NULL;
