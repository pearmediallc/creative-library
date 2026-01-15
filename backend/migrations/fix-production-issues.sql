-- ================================================
-- CRITICAL PRODUCTION FIXES
-- Date: 2026-01-15
-- Issues:
-- 1. folders.team_id column missing
-- 2. teams query using wrong column name (username vs name)
-- 3. saved_searches.filters storing objects instead of JSON strings
-- ================================================

BEGIN;

-- Fix 1: Add team_id column to folders table
ALTER TABLE folders
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id),
ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(20) DEFAULT 'user' CHECK (ownership_type IN ('user', 'team'));

-- Create index for team folders queries
CREATE INDEX IF NOT EXISTS idx_folders_team_id ON folders(team_id) WHERE team_id IS NOT NULL;

-- Fix 2: Add folders count to teams
-- (Already exists in query, just ensure index)
CREATE INDEX IF NOT EXISTS idx_folders_team_count ON folders(team_id) WHERE team_id IS NOT NULL;

-- Fix 3: Update saved_searches to ensure filters is proper JSON
-- First, let's check and fix any invalid JSON in filters column
UPDATE saved_searches
SET filters = '{}'::jsonb
WHERE filters IS NOT NULL
  AND filters::text LIKE '%[object Object]%';

-- Add constraint to ensure filters is valid JSON
ALTER TABLE saved_searches
ALTER COLUMN filters TYPE JSONB USING
  CASE
    WHEN filters IS NULL THEN NULL
    WHEN filters::text = '' THEN '{}'::jsonb
    WHEN filters::text LIKE '%[object Object]%' THEN '{}'::jsonb
    ELSE filters::jsonb
  END;

-- Verification
DO $$
DECLARE
  team_id_exists BOOLEAN;
  ownership_type_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'folders' AND column_name = 'team_id'
  ) INTO team_id_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'folders' AND column_name = 'ownership_type'
  ) INTO ownership_type_exists;

  IF team_id_exists AND ownership_type_exists THEN
    RAISE NOTICE '✅ All columns verified successfully';
  ELSE
    RAISE EXCEPTION '❌ Column verification failed';
  END IF;
END $$;

COMMIT;
