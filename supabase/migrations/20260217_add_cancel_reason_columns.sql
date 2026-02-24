-- ============================================
-- Migration: In-app cancellation feedback on users
-- Created: 2026-02-17
-- Purpose: Store cancel reason when user cancels subscription (in-app flow); email to support.
-- ============================================

-- Selected reason: too_expensive | not_enough_value | not_using_enough | found_better_alternative | other
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(64);

-- Free text when cancel_reason = 'other'. Required in app when Other is selected.
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancel_reason_other TEXT;

-- When the user cancelled (for reporting and analytics).
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

COMMENT ON COLUMN users.cancel_reason IS 'Reason for cancelling subscription (in-app flow): too_expensive, not_enough_value, not_using_enough, found_better_alternative, other.';
COMMENT ON COLUMN users.cancel_reason_other IS 'Free text when cancel_reason is other; required in UI when Other is selected.';
COMMENT ON COLUMN users.cancelled_at IS 'When the user cancelled their subscription (in-app cancellation flow).';
