-- ===================================================================
-- S3 DELETION TRACKING MIGRATION
-- Date: 2026-01-15
-- Purpose: Add deletion tracking fields for S3 soft delete functionality
-- ===================================================================

BEGIN;

-- Add deletion tracking columns to files table
ALTER TABLE files
ADD COLUMN IF NOT EXISTS is_soft_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS deleted_by_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
ADD COLUMN IF NOT EXISTS deleted_s3_key VARCHAR(500),
ADD COLUMN IF NOT EXISTS deletion_metadata_key VARCHAR(500),
ADD COLUMN IF NOT EXISTS uploader_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS can_restore BOOLEAN DEFAULT TRUE;

-- Add indexes for deletion queries
CREATE INDEX IF NOT EXISTS idx_files_is_soft_deleted ON files(is_soft_deleted) WHERE is_soft_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_deleted_by ON files(deleted_by) WHERE deleted_by IS NOT NULL;

-- Add deletion tracking columns to file_request_uploads table
ALTER TABLE file_request_uploads
ADD COLUMN IF NOT EXISTS is_soft_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS deleted_by_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
ADD COLUMN IF NOT EXISTS deleted_s3_key VARCHAR(500),
ADD COLUMN IF NOT EXISTS deletion_metadata_key VARCHAR(500),
ADD COLUMN IF NOT EXISTS uploader_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS can_restore BOOLEAN DEFAULT TRUE;

-- Add indexes for file_request_uploads deletion queries
CREATE INDEX IF NOT EXISTS idx_fr_uploads_is_soft_deleted ON file_request_uploads(is_soft_deleted) WHERE is_soft_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_fr_uploads_deleted_at ON file_request_uploads(deleted_at) WHERE deleted_at IS NOT NULL;

-- Update existing files to populate uploader_name from users table
UPDATE files f
SET uploader_name = u.name
FROM users u
WHERE f.owner_id = u.id AND f.uploader_name IS NULL;

-- Update existing file_request_uploads to populate uploader_name from editors table
UPDATE file_request_uploads fru
SET uploader_name = e.display_name
FROM editors e
WHERE fru.editor_id = e.id AND fru.uploader_name IS NULL;

COMMIT;

-- Verify migration
SELECT
  'files' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'files'
  AND column_name IN ('is_soft_deleted', 'deleted_at', 'deleted_by', 'uploader_name', 'can_restore')
ORDER BY column_name;

SELECT
  'file_request_uploads' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'file_request_uploads'
  AND column_name IN ('is_soft_deleted', 'deleted_at', 'deleted_by', 'uploader_name', 'can_restore')
ORDER BY column_name;
