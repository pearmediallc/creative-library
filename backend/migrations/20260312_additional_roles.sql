-- Add additional_roles column to users table for multi-role support
-- The primary 'role' column remains for backward compatibility
-- additional_roles stores supplementary roles as a TEXT array

ALTER TABLE users ADD COLUMN IF NOT EXISTS additional_roles TEXT[] DEFAULT '{}';

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_users_additional_roles ON users USING GIN (additional_roles);
