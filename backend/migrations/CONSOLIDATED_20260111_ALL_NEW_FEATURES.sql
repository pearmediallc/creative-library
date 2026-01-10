-- ==============================================================================
-- CONSOLIDATED MIGRATION - ALL NEW FEATURES
-- Date: 2026-01-11
-- Description: Complete end-to-end implementation of 9 major features
-- ==============================================================================
-- This migration includes:
-- 1. Slack Integration (OAuth, notifications, workspace connections)
-- 2. Activity Log Export to S3 (daily cron, presigned URLs)
-- 3. Enhanced File Requests (types, multi-editor, folders, timers, delivery notes)
--
-- IMPORTANT: Run this ONCE on a fresh database. If tables already exist, this
-- migration will skip them safely using CREATE TABLE IF NOT EXISTS.
-- ==============================================================================

-- ==============================================================================
-- PART 1: SLACK INTEGRATION
-- ==============================================================================

-- 1.1 CREATE slack_workspaces TABLE
CREATE TABLE IF NOT EXISTS slack_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id VARCHAR(50) UNIQUE NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL, -- Encrypted bot token
  bot_user_id VARCHAR(50),
  webhook_url TEXT,
  scope TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_slack_workspaces_team_id ON slack_workspaces(team_id);
CREATE INDEX IF NOT EXISTS idx_slack_workspaces_active ON slack_workspaces(is_active) WHERE is_active = TRUE;

-- 1.2 CREATE user_slack_connections TABLE
CREATE TABLE IF NOT EXISTS user_slack_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slack_user_id VARCHAR(50) NOT NULL,
  slack_username VARCHAR(255),
  slack_email VARCHAR(255),
  workspace_id UUID REFERENCES slack_workspaces(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_user_slack_user ON user_slack_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_slack_workspace ON user_slack_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_slack_slack_user_id ON user_slack_connections(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_user_slack_active ON user_slack_connections(is_active) WHERE is_active = TRUE;

-- 1.3 CREATE slack_notifications TABLE
CREATE TABLE IF NOT EXISTS slack_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id),
  slack_user_id VARCHAR(50),
  channel VARCHAR(100),
  message TEXT NOT NULL,
  blocks JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_slack_notifications_user ON slack_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_type ON slack_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_status ON slack_notifications(status);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_created ON slack_notifications(created_at DESC);

-- 1.4 ADD SLACK PREFERENCES TO users TABLE
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

-- 1.5 CREATE TRIGGERS FOR SLACK TABLES
CREATE OR REPLACE FUNCTION update_slack_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_slack_workspaces_updated_at ON slack_workspaces;
CREATE TRIGGER trigger_update_slack_workspaces_updated_at
BEFORE UPDATE ON slack_workspaces
FOR EACH ROW
EXECUTE FUNCTION update_slack_updated_at();

DROP TRIGGER IF EXISTS trigger_update_user_slack_connections_updated_at ON user_slack_connections;
CREATE TRIGGER trigger_update_user_slack_connections_updated_at
BEFORE UPDATE ON user_slack_connections
FOR EACH ROW
EXECUTE FUNCTION update_slack_updated_at();

-- ==============================================================================
-- PART 2: ACTIVITY LOG EXPORT TO S3
-- ==============================================================================

-- 2.1 CREATE activity_log_exports TABLE
CREATE TABLE IF NOT EXISTS activity_log_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_date DATE NOT NULL,
  s3_key TEXT NOT NULL,
  s3_url TEXT,
  s3_bucket VARCHAR(255),
  file_size BIGINT,
  record_count INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  UNIQUE(export_date)
);

CREATE INDEX IF NOT EXISTS idx_activity_log_exports_date ON activity_log_exports(export_date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_exports_status ON activity_log_exports(status);
CREATE INDEX IF NOT EXISTS idx_activity_log_exports_created ON activity_log_exports(created_at DESC);

-- 2.2 ADD EXPORT TRACKING TO activity_logs TABLE
ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS exported_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS export_id UUID REFERENCES activity_log_exports(id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_exported ON activity_logs(exported_at) WHERE exported_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_export_id ON activity_logs(export_id) WHERE export_id IS NOT NULL;

-- 2.3 CREATE FUNCTION TO GET UNEXPORTED LOGS
CREATE OR REPLACE FUNCTION get_unexported_activity_logs(target_date DATE)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email VARCHAR,
  user_role VARCHAR,
  action_type VARCHAR,
  resource_type VARCHAR,
  resource_id UUID,
  ip_address VARCHAR,
  user_agent TEXT,
  status VARCHAR,
  error_message TEXT,
  additional_data JSONB,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.user_id,
    al.user_email,
    al.user_role,
    al.action_type,
    al.resource_type,
    al.resource_id,
    al.ip_address,
    al.user_agent,
    al.status,
    al.error_message,
    al.additional_data,
    al.created_at
  FROM activity_logs al
  WHERE DATE(al.created_at) = target_date
    AND al.exported_at IS NULL
  ORDER BY al.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 2.4 CREATE CRON JOB TRACKING TABLE
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(100) UNIQUE NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  last_run_at TIMESTAMP,
  last_status VARCHAR(20),
  last_error TEXT,
  next_run_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_name ON scheduled_jobs(job_name);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_active ON scheduled_jobs(is_active) WHERE is_active = TRUE;

-- Insert activity log export job
INSERT INTO scheduled_jobs (job_name, job_type, next_run_at, is_active)
VALUES ('activity_log_daily_export', 'daily', CURRENT_DATE + INTERVAL '1 day' + TIME '02:00:00', TRUE)
ON CONFLICT (job_name) DO NOTHING;

-- 2.5 CREATE TRIGGER TO UPDATE updated_at
CREATE OR REPLACE FUNCTION update_scheduled_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_scheduled_jobs_updated_at ON scheduled_jobs;
CREATE TRIGGER trigger_update_scheduled_jobs_updated_at
BEFORE UPDATE ON scheduled_jobs
FOR EACH ROW
EXECUTE FUNCTION update_scheduled_jobs_updated_at();

-- ==============================================================================
-- PART 3: ENHANCED FILE REQUESTS
-- ==============================================================================

-- 3.1 ADD NEW COLUMNS TO file_requests TABLE
ALTER TABLE file_requests
  ADD COLUMN IF NOT EXISTS request_type VARCHAR(50) DEFAULT 'UGC + B-Roll',
  ADD COLUMN IF NOT EXISTS concept_notes TEXT,
  ADD COLUMN IF NOT EXISTS num_creatives INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS time_to_pick_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS time_to_complete_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_note TEXT;

CREATE INDEX IF NOT EXISTS idx_file_requests_type ON file_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_file_requests_completed ON file_requests(completed_at) WHERE completed_at IS NOT NULL;

-- Migrate existing description to concept_notes
UPDATE file_requests
SET concept_notes = description
WHERE concept_notes IS NULL AND description IS NOT NULL;

-- 3.2 CREATE file_request_editors TABLE (Many-to-Many)
CREATE TABLE IF NOT EXISTS file_request_editors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL REFERENCES editors(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  accepted_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  time_to_accept_minutes INTEGER,
  time_to_complete_minutes INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id, editor_id)
);

CREATE INDEX IF NOT EXISTS idx_file_request_editors_request ON file_request_editors(request_id);
CREATE INDEX IF NOT EXISTS idx_file_request_editors_editor ON file_request_editors(editor_id);
CREATE INDEX IF NOT EXISTS idx_file_request_editors_status ON file_request_editors(status);
CREATE INDEX IF NOT EXISTS idx_file_request_editors_user ON file_request_editors(user_id) WHERE user_id IS NOT NULL;

-- Migrate existing single-editor assignments
INSERT INTO file_request_editors (request_id, editor_id, status, created_at)
SELECT id, editor_id, 'pending', created_at
FROM file_requests
WHERE editor_id IS NOT NULL
ON CONFLICT (request_id, editor_id) DO NOTHING;

-- 3.3 CREATE file_request_folders TABLE
CREATE TABLE IF NOT EXISTS file_request_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  folder_name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_file_request_folders_request ON file_request_folders(request_id);
CREATE INDEX IF NOT EXISTS idx_file_request_folders_created_by ON file_request_folders(created_by);

-- 3.4 UPDATE file_request_uploads TABLE
ALTER TABLE file_request_uploads
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES file_request_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS editor_id UUID REFERENCES editors(id);

CREATE INDEX IF NOT EXISTS idx_file_request_uploads_folder ON file_request_uploads(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_editor ON file_request_uploads(editor_id) WHERE editor_id IS NOT NULL;

-- 3.5 CREATE TRIGGERS FOR FILE REQUEST TABLES
CREATE OR REPLACE FUNCTION update_file_request_editors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_file_request_editors_updated_at ON file_request_editors;
CREATE TRIGGER trigger_update_file_request_editors_updated_at
BEFORE UPDATE ON file_request_editors
FOR EACH ROW
EXECUTE FUNCTION update_file_request_editors_updated_at();

DROP TRIGGER IF EXISTS trigger_update_file_request_folders_updated_at ON file_request_folders;
CREATE TRIGGER trigger_update_file_request_folders_updated_at
BEFORE UPDATE ON file_request_folders
FOR EACH ROW
EXECUTE FUNCTION update_file_request_editors_updated_at();

-- 3.6 ADD CONSTRAINTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_num_creatives_positive'
  ) THEN
    ALTER TABLE file_requests
      ADD CONSTRAINT check_num_creatives_positive CHECK (num_creatives > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_time_to_pick_non_negative'
  ) THEN
    ALTER TABLE file_requests
      ADD CONSTRAINT check_time_to_pick_non_negative CHECK (time_to_pick_minutes >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_time_to_complete_non_negative'
  ) THEN
    ALTER TABLE file_requests
      ADD CONSTRAINT check_time_to_complete_non_negative CHECK (time_to_complete_minutes >= 0);
  END IF;
END $$;

-- ==============================================================================
-- MIGRATION COMPLETE
-- ==============================================================================

-- Verify all tables were created
SELECT
  'slack_workspaces' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'slack_workspaces')
    THEN '✓ Created' ELSE '✗ Missing' END as status
UNION ALL
SELECT 'user_slack_connections',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_slack_connections')
    THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL
SELECT 'slack_notifications',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'slack_notifications')
    THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL
SELECT 'activity_log_exports',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_log_exports')
    THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL
SELECT 'scheduled_jobs',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_jobs')
    THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL
SELECT 'file_request_editors',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'file_request_editors')
    THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL
SELECT 'file_request_folders',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'file_request_folders')
    THEN '✓ Created' ELSE '✗ Missing' END;

-- ==============================================================================
-- USAGE NOTES
-- ==============================================================================
/*
To run this migration:

1. Connect to your PostgreSQL database:
   psql -h localhost -U mac -d creative_library

2. Run the migration:
   \i /Users/mac/Desktop/creative-library/backend/migrations/CONSOLIDATED_20260111_ALL_NEW_FEATURES.sql

3. Verify the tables were created (last query in this file will show status)

4. Update your .env file with required keys:
   ENCRYPTION_KEY=<64-character hex string>
   SLACK_CLIENT_ID=<your-slack-client-id>
   SLACK_CLIENT_SECRET=<your-slack-client-secret>
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=<your-key>
   AWS_SECRET_ACCESS_KEY=<your-secret>
   ACTIVITY_LOG_S3_BUCKET=your-bucket-name

5. Restart your backend server

All tables use IF NOT EXISTS so this is safe to run multiple times.
*/
