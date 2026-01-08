-- ============================================
-- RENDER PRODUCTION DATABASE MIGRATION
-- ============================================
-- This script brings the Render production database up to date
-- with all features including file_requests, metadata_tags, and assignments
-- Run this on your Render PostgreSQL database
-- ============================================

-- ============================================
-- 1. FILE REQUESTS - Complete table with all columns
-- ============================================

-- Create file_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS file_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  request_token VARCHAR(64) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  deadline TIMESTAMP,
  allow_multiple_uploads BOOLEAN DEFAULT TRUE,
  require_email BOOLEAN DEFAULT FALSE,
  custom_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  closed_by UUID REFERENCES users(id)
);

-- Add editor_id column if not exists
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

-- Add assigned_buyer_id column if not exists
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

-- Create indexes for file_requests
CREATE INDEX IF NOT EXISTS idx_file_requests_token ON file_requests(request_token);
CREATE INDEX IF NOT EXISTS idx_file_requests_created_by ON file_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_file_requests_active ON file_requests(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_file_requests_folder ON file_requests(folder_id);

-- Add comment on table
COMMENT ON TABLE file_requests IS 'File upload requests created by users to collect files from external parties';

-- ============================================
-- 2. FILE REQUEST UPLOADS
-- ============================================

-- Uploaded files for requests
CREATE TABLE IF NOT EXISTS file_request_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  uploaded_by_email VARCHAR(255),
  uploaded_by_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_request_uploads_request ON file_request_uploads(file_request_id);
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_file ON file_request_uploads(file_id);

COMMENT ON TABLE file_request_uploads IS 'Tracks files uploaded through file request links';

-- ============================================
-- 3. METADATA TAGS - Complete tag management system
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
-- 4. MEDIA FILE TAGS - Junction table for tag-file associations
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
-- 5. METADATA TAGS VIEW - Tags with usage counts
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
-- 6. COMMENTS SYSTEM (if not exists)
-- ============================================

-- Comments table
CREATE TABLE IF NOT EXISTS file_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES file_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions JSONB DEFAULT '[]'::jsonb,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_file_comments_file_id ON file_comments(file_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_file_comments_user_id ON file_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_file_comments_parent ON file_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_file_comments_created ON file_comments(created_at DESC);

-- Comment reactions table
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES file_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(comment_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id);

-- ============================================
-- 7. SAVED SEARCHES / SMART COLLECTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  filters JSONB NOT NULL,
  is_smart BOOLEAN DEFAULT TRUE,
  is_favorite BOOLEAN DEFAULT FALSE,
  color VARCHAR(7),
  icon VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_favorite ON saved_searches(is_favorite) WHERE is_favorite = TRUE;

-- ============================================
-- 8. PUBLIC LINK ENHANCEMENTS
-- ============================================

-- Add columns to file_permissions table for public link features
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_permissions' AND column_name='is_public_link') THEN
    ALTER TABLE file_permissions ADD COLUMN is_public_link BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_permissions' AND column_name='link_password') THEN
    ALTER TABLE file_permissions ADD COLUMN link_password VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_permissions' AND column_name='link_expires_at') THEN
    ALTER TABLE file_permissions ADD COLUMN link_expires_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_permissions' AND column_name='disable_download') THEN
    ALTER TABLE file_permissions ADD COLUMN disable_download BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_permissions' AND column_name='view_count') THEN
    ALTER TABLE file_permissions ADD COLUMN view_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_permissions' AND column_name='last_viewed_at') THEN
    ALTER TABLE file_permissions ADD COLUMN last_viewed_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_permissions' AND column_name='max_views') THEN
    ALTER TABLE file_permissions ADD COLUMN max_views INTEGER;
  END IF;
END $$;

-- Index for public links
CREATE INDEX IF NOT EXISTS idx_file_permissions_public ON file_permissions(is_public_link) WHERE is_public_link = TRUE;
CREATE INDEX IF NOT EXISTS idx_file_permissions_expires ON file_permissions(link_expires_at) WHERE link_expires_at IS NOT NULL;

-- Public link access log
CREATE TABLE IF NOT EXISTS public_link_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_id UUID NOT NULL REFERENCES file_permissions(id) ON DELETE CASCADE,
  accessed_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  country VARCHAR(2),
  action VARCHAR(20) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_link_access_permission ON public_link_access_log(permission_id);
CREATE INDEX IF NOT EXISTS idx_public_link_access_date ON public_link_access_log(accessed_at DESC);

-- ============================================
-- 9. VERIFICATION QUERIES
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
    WHERE table_name='file_requests' AND column_name='folder_id'
  ) THEN
    RAISE NOTICE '✓ file_requests.folder_id column exists';
  ELSE
    RAISE WARNING '✗ file_requests.folder_id column NOT found';
  END IF;

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
-- 10. SUMMARY REPORT
-- ============================================

SELECT
  'Migration completed successfully!' as status,
  (SELECT COUNT(*) FROM metadata_tags) as total_tags,
  (SELECT COUNT(*) FROM media_file_tags) as total_tag_associations,
  (SELECT COUNT(*) FROM file_requests) as total_file_requests,
  NOW() as completed_at;
