-- Migration: Slack Integration
-- Date: 2026-01-11
-- Description: Add Slack workspace connections, user connections, and notification logging

-- ============================================================================
-- 1. CREATE slack_workspaces TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS slack_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id VARCHAR(50) UNIQUE NOT NULL, -- Slack team ID (e.g., T1234567890)
  team_name VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL, -- Encrypted bot token
  bot_user_id VARCHAR(50), -- Bot user ID (e.g., U1234567890)
  webhook_url TEXT, -- Incoming webhook URL (optional)
  scope TEXT, -- OAuth scopes granted
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_slack_workspaces_team_id ON slack_workspaces(team_id);
CREATE INDEX idx_slack_workspaces_active ON slack_workspaces(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 2. CREATE user_slack_connections TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_slack_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slack_user_id VARCHAR(50) NOT NULL, -- Slack user ID (e.g., U1234567890)
  slack_username VARCHAR(255),
  slack_email VARCHAR(255),
  workspace_id UUID REFERENCES slack_workspaces(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, workspace_id)
);

CREATE INDEX idx_user_slack_user ON user_slack_connections(user_id);
CREATE INDEX idx_user_slack_workspace ON user_slack_connections(workspace_id);
CREATE INDEX idx_user_slack_slack_user_id ON user_slack_connections(slack_user_id);
CREATE INDEX idx_user_slack_active ON user_slack_connections(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 3. CREATE slack_notifications TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS slack_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type VARCHAR(50) NOT NULL,
  -- Types: file_shared, file_request_created, file_request_completed,
  --        file_request_reassigned, public_link_created, comment_added, etc.
  user_id UUID REFERENCES users(id),
  slack_user_id VARCHAR(50),
  channel VARCHAR(100), -- Channel ID or DM channel
  message TEXT NOT NULL,
  blocks JSONB, -- Slack Block Kit JSON
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_slack_notifications_user ON slack_notifications(user_id);
CREATE INDEX idx_slack_notifications_type ON slack_notifications(notification_type);
CREATE INDEX idx_slack_notifications_status ON slack_notifications(status);
CREATE INDEX idx_slack_notifications_created ON slack_notifications(created_at DESC);

-- ============================================================================
-- 4. CREATE TRIGGER TO UPDATE updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_slack_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_slack_workspaces_updated_at
BEFORE UPDATE ON slack_workspaces
FOR EACH ROW
EXECUTE FUNCTION update_slack_updated_at();

CREATE TRIGGER trigger_update_user_slack_connections_updated_at
BEFORE UPDATE ON user_slack_connections
FOR EACH ROW
EXECUTE FUNCTION update_slack_updated_at();

-- ============================================================================
-- 5. ADD SLACK PREFERENCES TO USERS TABLE
-- ============================================================================

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

-- ============================================================================
-- ROLLBACK SCRIPT (for reference, do not execute)
-- ============================================================================
/*
ALTER TABLE users
  DROP COLUMN IF EXISTS slack_notifications_enabled,
  DROP COLUMN IF EXISTS slack_notification_preferences;

DROP TRIGGER IF EXISTS trigger_update_slack_workspaces_updated_at ON slack_workspaces;
DROP TRIGGER IF EXISTS trigger_update_user_slack_connections_updated_at ON user_slack_connections;
DROP FUNCTION IF EXISTS update_slack_updated_at();

DROP TABLE IF EXISTS slack_notifications CASCADE;
DROP TABLE IF EXISTS user_slack_connections CASCADE;
DROP TABLE IF EXISTS slack_workspaces CASCADE;
*/
