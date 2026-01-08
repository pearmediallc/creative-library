-- ============================================
-- FIX MISSING COLUMNS IN PRODUCTION
-- ============================================
-- This fixes the folder_id and deleted_at columns that failed in the previous migration
-- ============================================

-- Add folder_id column to file_requests if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='folder_id'
  ) THEN
    ALTER TABLE file_requests
    ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_file_requests_folder ON file_requests(folder_id);

    RAISE NOTICE '✓ Added folder_id column to file_requests';
  ELSE
    RAISE NOTICE '✓ folder_id column already exists in file_requests';
  END IF;
END $$;

-- Add deleted_at column to file_comments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_comments' AND column_name='deleted_at'
  ) THEN
    ALTER TABLE file_comments
    ADD COLUMN deleted_at TIMESTAMP;

    RAISE NOTICE '✓ Added deleted_at column to file_comments';
  ELSE
    RAISE NOTICE '✓ deleted_at column already exists in file_comments';
  END IF;
END $$;

-- Recreate the file_comments index with the deleted_at condition
DROP INDEX IF EXISTS idx_file_comments_file_id;
CREATE INDEX idx_file_comments_file_id ON file_comments(file_id) WHERE deleted_at IS NULL;

-- Verify all columns exist
DO $$
BEGIN
  RAISE NOTICE 'Verifying columns...';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='folder_id'
  ) THEN
    RAISE NOTICE '✓ file_requests.folder_id EXISTS';
  ELSE
    RAISE WARNING '✗ file_requests.folder_id MISSING';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_comments' AND column_name='deleted_at'
  ) THEN
    RAISE NOTICE '✓ file_comments.deleted_at EXISTS';
  ELSE
    RAISE WARNING '✗ file_comments.deleted_at MISSING';
  END IF;
END $$;

SELECT 'All missing columns fixed!' as status, NOW() as completed_at;
