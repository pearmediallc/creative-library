-- Migration: Add platform and vertical to file requests
-- Date: 2026-01-11
-- Description: Add platform and vertical fields to file_requests table

ALTER TABLE file_requests
  ADD COLUMN IF NOT EXISTS platform VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vertical VARCHAR(100);

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_file_requests_platform ON file_requests(platform);
CREATE INDEX IF NOT EXISTS idx_file_requests_vertical ON file_requests(vertical);

-- ROLLBACK (for reference):
-- ALTER TABLE file_requests DROP COLUMN IF EXISTS platform, DROP COLUMN IF EXISTS vertical;
