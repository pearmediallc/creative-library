-- ================================================
-- CRITICAL FIX: Team Members & File Request Uploads
-- Date: 2026-01-15
-- ================================================

BEGIN;

-- Fix 1: Rename role to team_role in team_members
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'role'
  ) THEN
    ALTER TABLE team_members RENAME COLUMN role TO team_role;
    RAISE NOTICE 'Column renamed: role → team_role';
  ELSE
    RAISE NOTICE 'Column team_role already exists, skipping rename';
  END IF;
END $$;

-- Fix 2: Add comments column to file_request_uploads
ALTER TABLE file_request_uploads
ADD COLUMN IF NOT EXISTS comments TEXT;

-- Verify changes
DO $$
DECLARE
  team_role_exists BOOLEAN;
  comments_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'team_role'
  ) INTO team_role_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'file_request_uploads' AND column_name = 'comments'
  ) INTO comments_exists;

  IF team_role_exists AND comments_exists THEN
    RAISE NOTICE '✅ All columns verified successfully';
  ELSE
    RAISE EXCEPTION '❌ Column verification failed';
  END IF;
END $$;

COMMIT;
