-- ============================================
-- FIX FILE REQUEST UPLOADS - ADD CREATED_AT
-- ============================================
-- This migration adds missing created_at column to file_request_uploads table
-- ============================================

\echo '=== Fix file_request_uploads Table ==='\
\echo ''

-- Add created_at column to file_request_uploads if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_request_uploads' AND column_name='created_at'
  ) THEN
    ALTER TABLE file_request_uploads
    ADD COLUMN created_at TIMESTAMP DEFAULT NOW();

    -- Update existing rows to have a created_at value
    UPDATE file_request_uploads
    SET created_at = NOW()
    WHERE created_at IS NULL;

    RAISE NOTICE '  ✓ Added created_at column to file_request_uploads';
  ELSE
    RAISE NOTICE '  ✓ created_at column already exists';
  END IF;
END $$;

\echo ''
\echo '=== Verification ==='\
\echo ''

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='created_at') THEN
    RAISE NOTICE '✓ file_request_uploads.created_at EXISTS';
  ELSE
    RAISE WARNING '✗ file_request_uploads.created_at MISSING';
  END IF;
END $$;

\echo ''
\echo '=== Migration Complete! ==='\
\echo ''

SELECT
  'file_request_uploads.created_at column added successfully!' as status,
  NOW() as completed_at;
