-- ============================================
-- Migration: Tolt affiliate attribution on users
-- Created: 2026-02-04
-- Purpose: Store affiliate/referral attribution for 30-day trial logic and reporting
-- ============================================

-- Tolt referral ID (from Tolt tracking or postback). Used for conversion reporting and trial length.
ALTER TABLE users ADD COLUMN IF NOT EXISTS tolt_referral_id VARCHAR(255);

-- Tolt partner (affiliate) ID. Identifies which affiliate referred this user.
ALTER TABLE users ADD COLUMN IF NOT EXISTS tolt_partner_id VARCHAR(255);

-- Quick flag: true if user signed up via affiliate link/code (30-day trial); false = standard 7-day trial.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_affiliate_user BOOLEAN DEFAULT FALSE;

-- When the user was attributed as an affiliate signup (for reporting and audit).
ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_signup_date TIMESTAMPTZ;

-- Index for lookups by referral (e.g. when processing Tolt webhooks or postbacks)
CREATE INDEX IF NOT EXISTS idx_users_tolt_referral_id ON users(tolt_referral_id) WHERE tolt_referral_id IS NOT NULL;

-- Index for filtering affiliate users (e.g. analytics, trial logic)
CREATE INDEX IF NOT EXISTS idx_users_is_affiliate_user ON users(is_affiliate_user) WHERE is_affiliate_user = TRUE;

COMMENT ON COLUMN users.tolt_referral_id IS 'Tolt referral record ID; used for conversion postbacks and 30-day trial eligibility.';
COMMENT ON COLUMN users.tolt_partner_id IS 'Tolt partner (affiliate) ID who referred this user.';
COMMENT ON COLUMN users.is_affiliate_user IS 'True if user came via affiliate (30-day trial); false for standard 7-day trial.';
COMMENT ON COLUMN users.affiliate_signup_date IS 'When affiliate attribution was set (signup or first checkout with referral).';
