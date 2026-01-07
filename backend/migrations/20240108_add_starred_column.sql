-- Migration: Add starred/favorites functionality
-- Date: 2024-01-08
-- Description: Adds is_starred column and starred_at timestamp to media_files table

-- Add is_starred column (boolean, defaults to false)
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

-- Add starred_at column (tracks when file was starred)
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS starred_at TIMESTAMP;

-- Create index for faster starred queries
CREATE INDEX IF NOT EXISTS idx_media_files_starred
ON media_files(is_starred, starred_at DESC)
WHERE is_starred = TRUE AND is_deleted = FALSE;

-- Create index for user-specific starred queries
CREATE INDEX IF NOT EXISTS idx_media_files_user_starred
ON media_files(uploaded_by, is_starred, starred_at DESC)
WHERE is_starred = TRUE AND is_deleted = FALSE;

-- Rollback script (if needed):
-- ALTER TABLE media_files DROP COLUMN IF EXISTS is_starred;
-- ALTER TABLE media_files DROP COLUMN IF EXISTS starred_at;
-- DROP INDEX IF EXISTS idx_media_files_starred;
-- DROP INDEX IF EXISTS idx_media_files_user_starred;
