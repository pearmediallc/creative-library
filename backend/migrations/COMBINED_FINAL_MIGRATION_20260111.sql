-- ============================================================================
-- COMBINED MIGRATION SCRIPT - Run this ONCE on Render
-- Date: 2026-01-11
-- Description: All database changes for new features
-- ============================================================================

-- 1. Add platform and vertical to file_requests
ALTER TABLE file_requests
  ADD COLUMN IF NOT EXISTS platform VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vertical VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_file_requests_platform ON file_requests(platform);
CREATE INDEX IF NOT EXISTS idx_file_requests_vertical ON file_requests(vertical);

-- 2. Verify all existing tables from previous migrations exist
-- (These should already exist from previous migrations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'slack_workspaces') THEN
    RAISE NOTICE 'slack_workspaces table not found - may need to run previous migrations';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'file_request_editors') THEN
    RAISE NOTICE 'file_request_editors table not found - may need to run previous migrations';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_log_exports') THEN
    RAISE NOTICE 'activity_log_exports table not found - may need to run previous migrations';
  END IF;
END $$;

-- 3. Verification query
SELECT 'Migration completed successfully!' as status;

-- Show all file_requests columns to verify platform and vertical were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'file_requests'
AND column_name IN ('platform', 'vertical', 'request_type', 'concept_notes', 'num_creatives')
ORDER BY column_name;

-- ROLLBACK (for reference only - do not execute):
-- ALTER TABLE file_requests DROP COLUMN IF EXISTS platform, DROP COLUMN IF EXISTS vertical;
