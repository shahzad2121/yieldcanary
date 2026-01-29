-- ============================================
-- Migration: Email Tracking System
-- Created: 2026-01-29
-- Purpose: Add email_logs table and subscription_status tracking
-- ============================================

-- Step 1: Add minimal state tracking to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'free';
-- Values: 'free', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'

ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_converted_to_paid BOOLEAN DEFAULT FALSE;
-- Flag to track if trial has converted (helps distinguish first post-trial payment)

-- Step 1.5: Backfill subscription_status for existing users
-- Update users who are already paid to have correct status based on their current state
UPDATE users
SET subscription_status = CASE
  -- Currently trialing (has trial_ends_at in future)
  WHEN is_paid = TRUE 
       AND trial_ends_at IS NOT NULL 
       AND trial_ends_at > NOW()
  THEN 'trialing'
  -- Active paid subscription (has tier, is_paid, and subscription hasn't expired)
  WHEN is_paid = TRUE 
       AND subscription_tier IN ('basic', 'advanced')
       AND (subscription_end IS NULL OR subscription_end > NOW())
  THEN 'active'
  -- Expired subscription (subscription_end in past)
  WHEN is_paid = TRUE 
       AND subscription_end IS NOT NULL 
       AND subscription_end <= NOW()
  THEN 'canceled'
  -- Default to free (already set by default, but explicit for clarity)
  ELSE 'free'
END
WHERE subscription_status = 'free';

-- Step 2: Create email_logs table (separate, normalized)
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type VARCHAR(50) NOT NULL,
  -- Values: 'trial_started', 'trial_ending_reminder', 'trial_converted_to_paid', 
  --         'payment_failed', 'subscription_cancelled'
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  template_id VARCHAR(100), -- e.g., 'trial_started', 'payment_failed'
  status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'bounced', 'delivered'
  error_message TEXT, -- If sending failed, store error here
  metadata JSONB, -- Optional: store additional context (trial_end_date, invoice_id, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create indexes for performance
-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);

-- Index for email type queries
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);

-- Index for time-based queries (analytics, scheduled jobs)
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Unique index: prevent duplicate emails (same user, same type, same day)
-- Using date_trunc with UTC timezone to ensure immutability
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_email_type_day
  ON email_logs(user_id, email_type, date_trunc('day', sent_at AT TIME ZONE 'UTC'));

-- Index for subscription status queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_status 
  ON users(subscription_status) 
  WHERE subscription_status IN ('trialing', 'active', 'past_due');

-- Step 4: Add comments for documentation
COMMENT ON TABLE email_logs IS 'Tracks all transactional emails sent to users. Prevents duplicates via unique functional index on (user_id, email_type, date_trunc(day, sent_at AT TIME ZONE UTC)).';
COMMENT ON COLUMN email_logs.email_type IS 'Values: trial_started, trial_ending_reminder, trial_converted_to_paid, payment_failed, subscription_cancelled';
COMMENT ON COLUMN email_logs.status IS 'Values: sent, failed, bounced, delivered';
COMMENT ON COLUMN users.subscription_status IS 'Mirrors Stripe subscription status. Values: free, trialing, active, past_due, canceled, unpaid';
COMMENT ON COLUMN users.trial_converted_to_paid IS 'Set to TRUE when trial converts to active paid subscription. Helps distinguish first post-trial payment from renewals.';
