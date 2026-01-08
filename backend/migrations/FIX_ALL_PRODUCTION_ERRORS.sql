-- ============================================
-- FIX ALL PRODUCTION ERRORS - COMPREHENSIVE
-- ============================================
-- This migration fixes all identified production issues:
-- 1. Missing allow_multiple_uploads column in file_requests
-- 2. Missing is_active column in team_members table
-- 3. Missing media tags routes (handled in code)
-- 4. Any other missing columns or constraints
-- ============================================

\echo '=== Starting Comprehensive Production Fix ==='
\echo ''

-- ============================================
-- 1. Fix file_requests table
-- ============================================
\echo '1. Fixing file_requests table...'

-- Add allow_multiple_uploads column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='allow_multiple_uploads'
  ) THEN
    ALTER TABLE file_requests
    ADD COLUMN allow_multiple_uploads BOOLEAN DEFAULT TRUE;

    RAISE NOTICE '  ✓ Added allow_multiple_uploads column to file_requests';
  ELSE
    RAISE NOTICE '  ✓ allow_multiple_uploads column already exists';
  END IF;
END $$;

-- Add require_email column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='require_email'
  ) THEN
    ALTER TABLE file_requests
    ADD COLUMN require_email BOOLEAN DEFAULT FALSE;

    RAISE NOTICE '  ✓ Added require_email column to file_requests';
  ELSE
    RAISE NOTICE '  ✓ require_email column already exists';
  END IF;
END $$;

-- Add custom_message column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='custom_message'
  ) THEN
    ALTER TABLE file_requests
    ADD COLUMN custom_message TEXT;

    RAISE NOTICE '  ✓ Added custom_message column to file_requests';
  ELSE
    RAISE NOTICE '  ✓ custom_message column already exists';
  END IF;
END $$;

-- Add editor_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='editor_id'
  ) THEN
    ALTER TABLE file_requests
    ADD COLUMN editor_id UUID REFERENCES editors(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_file_requests_editor ON file_requests(editor_id);

    RAISE NOTICE '  ✓ Added editor_id column to file_requests';
  ELSE
    RAISE NOTICE '  ✓ editor_id column already exists';
  END IF;
END $$;

-- Add assigned_buyer_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='assigned_buyer_id'
  ) THEN
    ALTER TABLE file_requests
    ADD COLUMN assigned_buyer_id UUID REFERENCES users(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_file_requests_assigned_buyer ON file_requests(assigned_buyer_id);

    RAISE NOTICE '  ✓ Added assigned_buyer_id column to file_requests';
  ELSE
    RAISE NOTICE '  ✓ assigned_buyer_id column already exists';
  END IF;
END $$;

-- Add is_active column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='is_active'
  ) THEN
    ALTER TABLE file_requests
    ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

    CREATE INDEX IF NOT EXISTS idx_file_requests_is_active ON file_requests(is_active);

    RAISE NOTICE '  ✓ Added is_active column to file_requests';
  ELSE
    RAISE NOTICE '  ✓ is_active column already exists';
  END IF;
END $$;

-- Add closed_at column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='closed_at'
  ) THEN
    ALTER TABLE file_requests
    ADD COLUMN closed_at TIMESTAMP;

    RAISE NOTICE '  ✓ Added closed_at column to file_requests';
  ELSE
    RAISE NOTICE '  ✓ closed_at column already exists';
  END IF;
END $$;

-- Add closed_by column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='closed_by'
  ) THEN
    ALTER TABLE file_requests
    ADD COLUMN closed_by UUID REFERENCES users(id) ON DELETE SET NULL;

    RAISE NOTICE '  ✓ Added closed_by column to file_requests';
  ELSE
    RAISE NOTICE '  ✓ closed_by column already exists';
  END IF;
END $$;

\echo ''

-- ============================================
-- 2. Fix team_members table
-- ============================================
\echo '2. Fixing team_members table...'

-- Add is_active column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='team_members' AND column_name='is_active'
  ) THEN
    ALTER TABLE team_members
    ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

    CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON team_members(is_active);

    RAISE NOTICE '  ✓ Added is_active column to team_members';
  ELSE
    RAISE NOTICE '  ✓ is_active column already exists';
  END IF;
END $$;

\echo ''

-- ============================================
-- 3. Ensure metadata_tags table exists
-- ============================================
\echo '3. Checking metadata_tags table...'

CREATE TABLE IF NOT EXISTS metadata_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, category)
);

CREATE INDEX IF NOT EXISTS idx_metadata_tags_category ON metadata_tags(category);
CREATE INDEX IF NOT EXISTS idx_metadata_tags_is_active ON metadata_tags(is_active);

\echo '  ✓ metadata_tags table verified'

-- ============================================
-- 4. Ensure media_file_tags table exists
-- ============================================
\echo '4. Checking media_file_tags table...'

CREATE TABLE IF NOT EXISTS media_file_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES metadata_tags(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(media_file_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_media_file_tags_media ON media_file_tags(media_file_id);
CREATE INDEX IF NOT EXISTS idx_media_file_tags_tag ON media_file_tags(tag_id);

\echo '  ✓ media_file_tags table verified'

-- ============================================
-- 5. Create metadata_tags_with_usage view
-- ============================================
\echo '5. Creating metadata_tags_with_usage view...'

DROP VIEW IF EXISTS metadata_tags_with_usage;

CREATE VIEW metadata_tags_with_usage AS
SELECT
  mt.id,
  mt.name,
  mt.category,
  mt.description,
  mt.is_active,
  mt.created_at,
  mt.updated_at,
  COUNT(mft.id) as usage_count
FROM metadata_tags mt
LEFT JOIN media_file_tags mft ON mt.id = mft.tag_id
WHERE mt.is_active = TRUE
GROUP BY mt.id, mt.name, mt.category, mt.description, mt.is_active, mt.created_at, mt.updated_at;

\echo '  ✓ metadata_tags_with_usage view created'

\echo ''

-- ============================================
-- 6. Ensure file_request_uploads table exists
-- ============================================
\echo '6. Checking file_request_uploads table...'

CREATE TABLE IF NOT EXISTS file_request_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  media_file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  uploader_email VARCHAR(255),
  uploader_name VARCHAR(255),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id, media_file_id)
);

CREATE INDEX IF NOT EXISTS idx_file_request_uploads_request ON file_request_uploads(request_id);
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_media ON file_request_uploads(media_file_id);

\echo '  ✓ file_request_uploads table verified'

\echo ''

-- ============================================
-- VERIFICATION
-- ============================================
\echo '=== Verification ==='
\echo ''

DO $$
DECLARE
  missing_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check file_requests columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='allow_multiple_uploads') THEN
    missing_columns := array_append(missing_columns, 'file_requests.allow_multiple_uploads');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='require_email') THEN
    missing_columns := array_append(missing_columns, 'file_requests.require_email');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='custom_message') THEN
    missing_columns := array_append(missing_columns, 'file_requests.custom_message');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='editor_id') THEN
    missing_columns := array_append(missing_columns, 'file_requests.editor_id');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='assigned_buyer_id') THEN
    missing_columns := array_append(missing_columns, 'file_requests.assigned_buyer_id');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='is_active') THEN
    missing_columns := array_append(missing_columns, 'file_requests.is_active');
  END IF;

  -- Check team_members columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='is_active') THEN
    missing_columns := array_append(missing_columns, 'team_members.is_active');
  END IF;

  -- Report results
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE WARNING '✗ MISSING COLUMNS: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✓ All required columns exist!';
  END IF;

  -- Check tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='metadata_tags') THEN
    RAISE NOTICE '✓ metadata_tags table exists';
  ELSE
    RAISE WARNING '✗ metadata_tags table missing';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='media_file_tags') THEN
    RAISE NOTICE '✓ media_file_tags table exists';
  ELSE
    RAISE WARNING '✗ media_file_tags table missing';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='file_request_uploads') THEN
    RAISE NOTICE '✓ file_request_uploads table exists';
  ELSE
    RAISE WARNING '✗ file_request_uploads table missing';
  END IF;

  -- Check view
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name='metadata_tags_with_usage') THEN
    RAISE NOTICE '✓ metadata_tags_with_usage view exists';
  ELSE
    RAISE WARNING '✗ metadata_tags_with_usage view missing';
  END IF;
END $$;

\echo ''
\echo '=== Migration Complete! ==='
\echo ''

SELECT
  'All production errors fixed!' as status,
  NOW() as completed_at;
