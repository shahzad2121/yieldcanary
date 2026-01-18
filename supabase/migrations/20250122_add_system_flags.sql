-- Create system_flags table for managing system-wide flags
-- Used to coordinate between bootstrap script and cron jobs
CREATE TABLE IF NOT EXISTS system_flags (
  key TEXT PRIMARY KEY,
  value BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE system_flags IS 'System-wide flags for coordinating between different services (e.g., bootstrap_running flag to prevent cron jobs during database rebuilds)';

COMMENT ON COLUMN system_flags.key IS 'Unique identifier for the flag (e.g., bootstrap_running)';
COMMENT ON COLUMN system_flags.value IS 'Boolean value of the flag';
COMMENT ON COLUMN system_flags.updated_at IS 'Timestamp when the flag was last updated';

-- Insert initial flag (false by default)
INSERT INTO system_flags (key, value) 
VALUES ('bootstrap_running', false)
ON CONFLICT (key) DO NOTHING;

