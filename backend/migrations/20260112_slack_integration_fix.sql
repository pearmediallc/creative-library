-- Migration: Fix Slack Integration (Add Missing User Columns)
-- Date: 2026-01-12
-- Description: Add Slack notification preferences to users table if not exists

-- Add Slack preferences to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS slack_notifications_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS slack_notification_preferences JSONB DEFAULT '{
    "file_shared": true,
    "file_request_created": true,
    "file_request_completed": true,
    "file_request_reassigned": true,
    "public_link_created": true,
    "comment_mentioned": true
  }'::jsonb;

-- Update existing users to enable notifications by default
UPDATE users
SET slack_notifications_enabled = TRUE
WHERE slack_notifications_enabled IS NULL;

SELECT 'Slack user preferences added successfully!' AS status;
