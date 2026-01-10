-- Migration: Activity Log Export to S3
-- Date: 2026-01-11
-- Description: Track daily activity log exports to AWS S3

-- ============================================================================
-- 1. CREATE activity_log_exports TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_log_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_date DATE NOT NULL,
  s3_key TEXT NOT NULL, -- Path in S3 (e.g., activity-logs/2026/01/2026-01-11.json)
  s3_url TEXT, -- Presigned URL for download (temporary)
  s3_bucket VARCHAR(255), -- Bucket name
  file_size BIGINT, -- File size in bytes
  record_count INTEGER, -- Number of log records exported
  status VARCHAR(20) DEFAULT 'pending', -- pending, uploading, completed, failed
  error_message TEXT,
  created_by UUID REFERENCES users(id), -- User who triggered export (or NULL for cron)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  UNIQUE(export_date) -- Only one export per date
);

CREATE INDEX idx_activity_log_exports_date ON activity_log_exports(export_date DESC);
CREATE INDEX idx_activity_log_exports_status ON activity_log_exports(status);
CREATE INDEX idx_activity_log_exports_created ON activity_log_exports(created_at DESC);

-- ============================================================================
-- 2. ADD EXPORT TRACKING TO activity_logs TABLE
-- ============================================================================

ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS exported_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS export_id UUID REFERENCES activity_log_exports(id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_exported ON activity_logs(exported_at) WHERE exported_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_export_id ON activity_logs(export_id) WHERE export_id IS NOT NULL;

-- ============================================================================
-- 3. CREATE FUNCTION TO GET UNEXPORTED LOGS
-- ============================================================================

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

-- ============================================================================
-- 4. CREATE CRON JOB TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(100) UNIQUE NOT NULL,
  job_type VARCHAR(50) NOT NULL, -- daily, weekly, monthly
  last_run_at TIMESTAMP,
  last_status VARCHAR(20), -- success, failed
  last_error TEXT,
  next_run_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scheduled_jobs_name ON scheduled_jobs(job_name);
CREATE INDEX idx_scheduled_jobs_active ON scheduled_jobs(is_active) WHERE is_active = TRUE;

-- Insert activity log export job
INSERT INTO scheduled_jobs (job_name, job_type, next_run_at, is_active)
VALUES ('activity_log_daily_export', 'daily', CURRENT_DATE + INTERVAL '1 day' + TIME '02:00:00', TRUE)
ON CONFLICT (job_name) DO NOTHING;

-- ============================================================================
-- 5. CREATE TRIGGER TO UPDATE updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_scheduled_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_scheduled_jobs_updated_at
BEFORE UPDATE ON scheduled_jobs
FOR EACH ROW
EXECUTE FUNCTION update_scheduled_jobs_updated_at();

-- ============================================================================
-- ROLLBACK SCRIPT (for reference, do not execute)
-- ============================================================================
/*
DROP TRIGGER IF EXISTS trigger_update_scheduled_jobs_updated_at ON scheduled_jobs;
DROP FUNCTION IF EXISTS update_scheduled_jobs_updated_at();
DROP FUNCTION IF EXISTS get_unexported_activity_logs(DATE);

ALTER TABLE activity_logs
  DROP COLUMN IF EXISTS exported_at,
  DROP COLUMN IF EXISTS export_id;

DROP TABLE IF EXISTS scheduled_jobs CASCADE;
DROP TABLE IF EXISTS activity_log_exports CASCADE;
*/
