-- ============================================
-- ADD MISSING joined_at COLUMN TO team_members
-- ============================================

\echo '=== Adding joined_at column to team_members ==='

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
\echo '=== Verification ==='

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='team_members' AND column_name='joined_at'
  ) THEN
    RAISE NOTICE '✓ team_members.joined_at EXISTS';
  ELSE
    RAISE WARNING '✗ team_members.joined_at MISSING';
  END IF;
END $$;

\echo ''
\echo '=== Migration Complete! ==='

SELECT
  'joined_at column added successfully!' as status,
  NOW() as completed_at;
