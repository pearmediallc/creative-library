-- ============================================
-- COMPLETE MIGRATION SCRIPT
-- Run this in pgAdmin to create all necessary tables and columns
-- ============================================

-- ============================================
-- 1. FILE REQUESTS - Add editor and buyer assignment columns
-- ============================================

-- Add editor_id column to file_requests if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='editor_id'
  ) THEN
    ALTER TABLE file_requests
    ADD COLUMN editor_id UUID REFERENCES editors(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_file_requests_editor ON file_requests(editor_id);

    COMMENT ON COLUMN file_requests.editor_id IS 'Editor to assign uploaded files to';
  END IF;
END $$;

-- Add assigned_buyer_id column to file_requests if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='assigned_buyer_id'
  ) THEN
    ALTER TABLE file_requests
    ADD COLUMN assigned_buyer_id UUID REFERENCES users(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_file_requests_buyer ON file_requests(assigned_buyer_id);

    COMMENT ON COLUMN file_requests.assigned_buyer_id IS 'Buyer to assign uploaded files to';
  END IF;
END $$;

-- ============================================
-- 2. METADATA TAGS - Complete tag management system
-- ============================================

-- Create metadata_tags table
CREATE TABLE IF NOT EXISTS metadata_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for metadata_tags
CREATE INDEX IF NOT EXISTS idx_metadata_tags_name ON metadata_tags(name);
CREATE INDEX IF NOT EXISTS idx_metadata_tags_category ON metadata_tags(category);
CREATE INDEX IF NOT EXISTS idx_metadata_tags_created_by ON metadata_tags(created_by);
CREATE INDEX IF NOT EXISTS idx_metadata_tags_is_active ON metadata_tags(is_active);

-- Add comment
COMMENT ON TABLE metadata_tags IS 'Reusable metadata tags for organizing media files';

-- ============================================
-- 3. MEDIA FILE TAGS - Junction table for tag-file associations
-- ============================================

-- Create media_file_tags junction table
CREATE TABLE IF NOT EXISTS media_file_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_file_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES metadata_tags(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(media_file_id, tag_id)
);

-- Create indexes for media_file_tags
CREATE INDEX IF NOT EXISTS idx_media_file_tags_file ON media_file_tags(media_file_id);
CREATE INDEX IF NOT EXISTS idx_media_file_tags_tag ON media_file_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_media_file_tags_added_by ON media_file_tags(added_by);

-- Add comment
COMMENT ON TABLE media_file_tags IS 'Junction table linking media files to metadata tags';

-- ============================================
-- 4. METADATA TAGS VIEW - Tags with usage counts
-- ============================================

-- Create or replace view for tags with usage counts
CREATE OR REPLACE VIEW metadata_tags_with_usage AS
SELECT
  mt.id,
  mt.name,
  mt.category,
  mt.description,
  mt.created_by,
  mt.created_at,
  mt.updated_at,
  mt.is_active,
  COUNT(mft.id) as usage_count
FROM metadata_tags mt
LEFT JOIN media_file_tags mft ON mt.id = mft.tag_id
WHERE mt.is_active = TRUE
GROUP BY mt.id, mt.name, mt.category, mt.description, mt.created_by, mt.created_at, mt.updated_at, mt.is_active;

-- Add comment
COMMENT ON VIEW metadata_tags_with_usage IS 'Tags with computed usage counts from media_file_tags';

-- ============================================
-- 5. VERIFICATION QUERIES
-- ============================================

-- Check if all tables exist
DO $$
BEGIN
  RAISE NOTICE 'Checking tables...';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'file_requests') THEN
    RAISE NOTICE '✓ file_requests table exists';
  ELSE
    RAISE WARNING '✗ file_requests table NOT found';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'metadata_tags') THEN
    RAISE NOTICE '✓ metadata_tags table exists';
  ELSE
    RAISE WARNING '✗ metadata_tags table NOT found';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media_file_tags') THEN
    RAISE NOTICE '✓ media_file_tags table exists';
  ELSE
    RAISE WARNING '✗ media_file_tags table NOT found';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'metadata_tags_with_usage') THEN
    RAISE NOTICE '✓ metadata_tags_with_usage view exists';
  ELSE
    RAISE WARNING '✗ metadata_tags_with_usage view NOT found';
  END IF;
END $$;

-- Check if columns exist in file_requests
DO $$
BEGIN
  RAISE NOTICE 'Checking file_requests columns...';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='editor_id'
  ) THEN
    RAISE NOTICE '✓ file_requests.editor_id column exists';
  ELSE
    RAISE WARNING '✗ file_requests.editor_id column NOT found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_requests' AND column_name='assigned_buyer_id'
  ) THEN
    RAISE NOTICE '✓ file_requests.assigned_buyer_id column exists';
  ELSE
    RAISE WARNING '✗ file_requests.assigned_buyer_id column NOT found';
  END IF;
END $$;

-- ============================================
-- 6. SUMMARY REPORT
-- ============================================

SELECT
  'Migration completed successfully!' as status,
  (SELECT COUNT(*) FROM metadata_tags) as total_tags,
  (SELECT COUNT(*) FROM media_file_tags) as total_tag_associations,
  NOW() as completed_at;
