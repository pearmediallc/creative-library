-- Migration: File Request Enhancements
-- Purpose: Add status tracking, upload history, and improved organization
-- Date: 2026-01-24

BEGIN;

-- 1. Add status and lifecycle columns to file_requests
ALTER TABLE file_requests
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open'
  CHECK (status IN ('open', 'in_progress', 'uploaded', 'launched', 'closed', 'reopened')),
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS launched_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS launched_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reopen_count INTEGER DEFAULT 0;

-- 2. Create upload tracking table
CREATE TABLE IF NOT EXISTS file_request_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  upload_type VARCHAR(20) NOT NULL CHECK (upload_type IN ('file', 'folder')),
  folder_path TEXT, -- Original folder structure if folder upload
  folder_name TEXT, -- Name of uploaded folder (if folder upload)
  file_count INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id)
);

-- 3. Add upload_session_id to media_files to link files to upload sessions
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS upload_session_id UUID REFERENCES file_request_uploads(id);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_requests_status ON file_requests(status);
CREATE INDEX IF NOT EXISTS idx_file_requests_uploaded_at ON file_requests(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_request ON file_request_uploads(file_request_id);
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_user ON file_request_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_created ON file_request_uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_media_files_upload_session ON media_files(upload_session_id);

-- 5. Migrate existing data
-- Set status based on current state
UPDATE file_requests
SET status = CASE
  WHEN completed_at IS NOT NULL THEN 'closed'
  WHEN (SELECT COUNT(*) FROM media_files WHERE metadata->>'request_id' = file_requests.id::text) > 0 THEN 'uploaded'
  WHEN array_length(assigned_editors, 1) > 0 THEN 'in_progress'
  ELSE 'open'
END
WHERE status IS NULL OR status = 'open';

-- Set closed_at from completed_at for backward compatibility
UPDATE file_requests
SET closed_at = completed_at, closed_by = created_by
WHERE completed_at IS NOT NULL AND closed_at IS NULL;

COMMIT;
