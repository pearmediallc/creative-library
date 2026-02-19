-- Migration: Add comprehensive notification preferences for browser popups and sounds
-- Allows users to control when they receive browser notifications and notification sounds

-- Add browser notification preferences to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS browser_notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_sound_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_type_preferences JSONB DEFAULT '{"file_request_assigned": {"browser": true, "sound": true, "slack": true}, "launch_request_assigned": {"browser": true, "sound": true, "slack": true}, "file_shared": {"browser": true, "sound": true, "slack": true}, "file_request_completed": {"browser": true, "sound": true, "slack": true}, "file_request_reassigned": {"browser": true, "sound": true, "slack": true}, "launch_request_created": {"browser": true, "sound": true, "slack": true}, "launch_request_updated": {"browser": false, "sound": false, "slack": false}, "launch_request_launched": {"browser": true, "sound": true, "slack": true}, "launch_request_closed": {"browser": true, "sound": true, "slack": true}, "public_link_created": {"browser": false, "sound": false, "slack": false}, "comment_mentioned": {"browser": true, "sound": true, "slack": true}, "access_request": {"browser": true, "sound": true, "slack": true}, "access_request_approved": {"browser": true, "sound": true, "slack": true}, "access_request_denied": {"browser": true, "sound": true, "slack": true}}'::jsonb;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_browser_notifications ON users(browser_notifications_enabled);

-- Update existing users to have notification preferences enabled by default
UPDATE users
SET
  browser_notifications_enabled = COALESCE(browser_notifications_enabled, TRUE),
  notification_sound_enabled = COALESCE(notification_sound_enabled, TRUE),
  notification_type_preferences = COALESCE(notification_type_preferences, '{"file_request_assigned": {"browser": true, "sound": true, "slack": true}, "launch_request_assigned": {"browser": true, "sound": true, "slack": true}, "file_shared": {"browser": true, "sound": true, "slack": true}, "file_request_completed": {"browser": true, "sound": true, "slack": true}, "file_request_reassigned": {"browser": true, "sound": true, "slack": true}, "launch_request_created": {"browser": true, "sound": true, "slack": true}, "launch_request_updated": {"browser": false, "sound": false, "slack": false}, "launch_request_launched": {"browser": true, "sound": true, "slack": true}, "launch_request_closed": {"browser": true, "sound": true, "slack": true}, "public_link_created": {"browser": false, "sound": false, "slack": false}, "comment_mentioned": {"browser": true, "sound": true, "slack": true}, "access_request": {"browser": true, "sound": true, "slack": true}, "access_request_approved": {"browser": true, "sound": true, "slack": true}, "access_request_denied": {"browser": true, "sound": true, "slack": true}}'::jsonb)
WHERE is_active = TRUE;

-- Display updated user notification preferences
SELECT
  id,
  name,
  email,
  browser_notifications_enabled,
  notification_sound_enabled,
  slack_notifications_enabled
FROM users
WHERE is_active = TRUE
ORDER BY name
LIMIT 10;
