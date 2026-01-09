-- ============================================
-- FIX STARRED FILES & JOINED_AT COLUMNS
-- ============================================
-- This migration fixes:
-- 1. Missing is_starred and starred_at columns causing 500 errors
-- 2. Missing joined_at column in team_members
-- ============================================

\echo '=== Fix Starred Files Columns ==='\
\echo ''

-- Add is_starred column to media_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='media_files' AND column_name='is_starred'
  ) THEN
    ALTER TABLE media_files
    ADD COLUMN is_starred BOOLEAN DEFAULT FALSE;

    RAISE NOTICE '  ✓ Added is_starred column to media_files';
  ELSE
    RAISE NOTICE '  ✓ is_starred column already exists';
  END IF;
END $$;

-- Add starred_at column to media_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='media_files' AND column_name='starred_at'
  ) THEN
    ALTER TABLE media_files
    ADD COLUMN starred_at TIMESTAMP;

    RAISE NOTICE '  ✓ Added starred_at column to media_files';
  ELSE
    RAISE NOTICE '  ✓ starred_at column already exists';
  END IF;
END $$;

-- Create indexes for starred files
CREATE INDEX IF NOT EXISTS idx_media_files_starred
ON media_files(is_starred, starred_at DESC)
WHERE is_starred = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_files_user_starred
ON media_files(uploaded_by, is_starred, starred_at DESC)
WHERE is_starred = TRUE AND deleted_at IS NULL;

\echo ''
\echo '=== Fix team_members joined_at Column ==='\
\echo ''

-- Add joined_at column to team_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='team_members' AND column_name='joined_at'
  ) THEN
    ALTER TABLE team_members
    ADD COLUMN joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    -- Update existing rows to have a joined_at value
    UPDATE team_members
    SET joined_at = created_at
    WHERE joined_at IS NULL;

    RAISE NOTICE '  ✓ Added joined_at column to team_members';
  ELSE
    RAISE NOTICE '  ✓ joined_at column already exists';
  END IF;
END $$;

\echo ''
\echo '=== Verification ==='\
\echo ''

DO $$
BEGIN
  -- Check media_files columns
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_files' AND column_name='is_starred') THEN
    RAISE NOTICE '✓ media_files.is_starred EXISTS';
  ELSE
    RAISE WARNING '✗ media_files.is_starred MISSING';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_files' AND column_name='starred_at') THEN
    RAISE NOTICE '✓ media_files.starred_at EXISTS';
  ELSE
    RAISE WARNING '✗ media_files.starred_at MISSING';
  END IF;

  -- Check team_members column
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='joined_at') THEN
    RAISE NOTICE '✓ team_members.joined_at EXISTS';
  ELSE
    RAISE WARNING '✗ team_members.joined_at MISSING';
  END IF;
END $$;

\echo ''
\echo '=== Migration Complete! ==='\
\echo ''

SELECT
  'Starred & joined_at columns added successfully!' as status,
  NOW() as completed_at;
