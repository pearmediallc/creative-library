-- ============================================
-- MASTER MIGRATION - ALL FEATURES
-- ============================================
-- This is a comprehensive migration that includes ALL features
-- Run this on a fresh database OR incrementally on existing database
-- Date: 2024-01-13
-- ============================================
--
-- INCLUDES:
-- 1. Base Schema (users, editors, media_files, facebook_ads, etc.)
-- 2. Folders System (folders, file_permissions, teams, upload_batches)
-- 3. Metadata Tracking (metadata_stripped, metadata_embedded, metadata_operations)
-- 4. Starred/Favorites (is_starred, starred_at)
-- 5. Comments System (file_comments, comment_reactions)
-- 6. File Requests (file_requests, file_request_uploads)
-- 7. Smart Collections (saved_searches)
-- 8. Public Link Enhancements (public link columns + access log)
--
-- ============================================

BEGIN;

-- ============================================
-- PHASE 1: BASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For gen_random_uuid()

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'creative',
  upload_limit_monthly INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- Editors table
CREATE TABLE IF NOT EXISTS editors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_editors_name ON editors(name) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_editors_active ON editors(is_active);

-- Media files table
CREATE TABLE IF NOT EXISTS media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  s3_url TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  thumbnail_url TEXT,
  file_type VARCHAR(20) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration FLOAT,
  editor_id UUID REFERENCES editors(id) ON DELETE SET NULL,
  editor_name VARCHAR(255) NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  upload_date TIMESTAMP DEFAULT NOW(),
  tags TEXT[],
  description TEXT,
  campaign_hint VARCHAR(255),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_editor_name ON media_files(editor_name) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_media_editor_id ON media_files(editor_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_media_upload_date ON media_files(upload_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_media_file_type ON media_files(file_type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON media_files(uploaded_by) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_media_tags ON media_files USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_media_not_deleted ON media_files(is_deleted) WHERE is_deleted = FALSE;

-- Upload tracking table
CREATE TABLE IF NOT EXISTS upload_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  file_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
  upload_month VARCHAR(7) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_upload_tracking_month ON upload_tracking(user_id, upload_month);

-- Access logs table
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  file_id UUID REFERENCES media_files(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  additional_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_user ON access_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_file ON access_logs(file_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action, created_at DESC);

-- Facebook campaigns table
CREATE TABLE IF NOT EXISTS facebook_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fb_campaign_id VARCHAR(255) UNIQUE NOT NULL,
  fb_ad_account_id VARCHAR(255) NOT NULL,
  campaign_name TEXT,
  status VARCHAR(50),
  objective VARCHAR(100),
  created_time TIMESTAMP,
  last_synced_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fb_campaigns_account ON facebook_campaigns(fb_ad_account_id);
CREATE INDEX IF NOT EXISTS idx_fb_campaigns_fb_id ON facebook_campaigns(fb_campaign_id);

-- Facebook ads table
CREATE TABLE IF NOT EXISTS facebook_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fb_ad_id VARCHAR(255) UNIQUE NOT NULL,
  fb_campaign_id VARCHAR(255) REFERENCES facebook_campaigns(fb_campaign_id),
  fb_ad_account_id VARCHAR(255) NOT NULL,
  ad_name TEXT NOT NULL,
  ad_name_hash VARCHAR(64),
  ad_name_last_checked TIMESTAMP DEFAULT NOW(),
  ad_name_change_count INTEGER DEFAULT 0,
  status VARCHAR(50),
  editor_name VARCHAR(255),
  editor_id UUID REFERENCES editors(id),
  extraction_method VARCHAR(50) DEFAULT 'ad_name_regex',
  extraction_confidence DECIMAL(3, 2),
  spend DECIMAL(12, 2),
  impressions BIGINT,
  clicks BIGINT,
  cpm DECIMAL(10, 2),
  cpc DECIMAL(10, 2),
  ctr DECIMAL(10, 4),
  cost_per_result DECIMAL(10, 2),
  results INTEGER,
  insights_date_start DATE,
  insights_date_end DATE,
  last_synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fb_ads_campaign ON facebook_ads(fb_campaign_id);
CREATE INDEX IF NOT EXISTS idx_fb_ads_editor_name ON facebook_ads(editor_name) WHERE editor_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fb_ads_editor_id ON facebook_ads(editor_id) WHERE editor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fb_ads_date_range ON facebook_ads(insights_date_start, insights_date_end);
CREATE INDEX IF NOT EXISTS idx_fb_ads_account ON facebook_ads(fb_ad_account_id);
CREATE INDEX IF NOT EXISTS idx_fb_ads_hash ON facebook_ads(ad_name_hash);

-- Ad name changes table
CREATE TABLE IF NOT EXISTS ad_name_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fb_ad_id VARCHAR(255) NOT NULL,
  fb_campaign_id VARCHAR(255),
  fb_ad_account_id VARCHAR(255) NOT NULL,
  old_ad_name TEXT NOT NULL,
  new_ad_name TEXT NOT NULL,
  changed_at TIMESTAMP NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW(),
  old_editor_name VARCHAR(255),
  new_editor_name VARCHAR(255),
  editor_changed BOOLEAN GENERATED ALWAYS AS (
    COALESCE(old_editor_name, '') != COALESCE(new_editor_name, '')
  ) STORED,
  changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_via VARCHAR(50),
  change_source VARCHAR(50) DEFAULT 'api_detection',
  ip_address INET,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_name_changes_fb_ad ON ad_name_changes(fb_ad_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_name_changes_editor ON ad_name_changes(editor_changed) WHERE editor_changed = TRUE;
CREATE INDEX IF NOT EXISTS idx_ad_name_changes_detected ON ad_name_changes(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_name_changes_user ON ad_name_changes(changed_by_user_id) WHERE changed_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_name_changes_account ON ad_name_changes(fb_ad_account_id, changed_at DESC);

-- Facebook auth table
CREATE TABLE IF NOT EXISTS facebook_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  fb_user_id VARCHAR(255),
  fb_user_name VARCHAR(255),
  fb_user_email VARCHAR(255),
  granted_permissions TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fb_auth_user ON facebook_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_fb_auth_fb_user ON facebook_auth(fb_user_id);

-- Analytics cache table
CREATE TABLE IF NOT EXISTS analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  editor_name VARCHAR(255),
  date_range_start DATE,
  date_range_end DATE,
  data JSONB NOT NULL,
  computed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_key ON analytics_cache(cache_key) WHERE expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_analytics_cache_editor ON analytics_cache(editor_name, date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON analytics_cache(expires_at);

-- Admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_date ON admin_audit_log(created_at DESC);

-- ============================================
-- PHASE 2: FOLDERS SYSTEM
-- ============================================

-- Folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  parent_folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_auto_created BOOLEAN DEFAULT FALSE,
  folder_type VARCHAR(50) DEFAULT 'user',
  description TEXT,
  color VARCHAR(20),
  s3_path TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_folder_name_per_parent UNIQUE(parent_folder_id, name, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_not_deleted ON folders(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders USING btree(parent_folder_id, name);
CREATE INDEX IF NOT EXISTS idx_folders_type ON folders(folder_type);

-- Add folder support to media_files
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS upload_batch_id UUID;

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS assigned_buyer_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS parent_file_id UUID REFERENCES media_files(id);

CREATE INDEX IF NOT EXISTS idx_media_folder ON media_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_media_batch ON media_files(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_media_buyer ON media_files(assigned_buyer_id);
CREATE INDEX IF NOT EXISTS idx_media_parent ON media_files(parent_file_id);

-- File permissions table
CREATE TABLE IF NOT EXISTS file_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NOT NULL,
  grantee_type VARCHAR(50) NOT NULL,
  grantee_id UUID NOT NULL,
  permission_type VARCHAR(50) NOT NULL,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(resource_type, resource_id, grantee_type, grantee_id, permission_type)
);

CREATE INDEX IF NOT EXISTS idx_permissions_resource ON file_permissions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_permissions_grantee ON file_permissions(grantee_type, grantee_id);
CREATE INDEX IF NOT EXISTS idx_permissions_expires ON file_permissions(expires_at) WHERE expires_at IS NOT NULL;

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(is_active) WHERE is_active = TRUE;

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- Upload batches table
CREATE TABLE IF NOT EXISTS upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  folder_id UUID REFERENCES folders(id),
  total_files INTEGER NOT NULL DEFAULT 0,
  completed_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'in_progress',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batches_user ON upload_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON upload_batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_created ON upload_batches(created_at DESC);

-- File operations log table
CREATE TABLE IF NOT EXISTS file_operations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  operation_type VARCHAR(50) NOT NULL,
  source_folder_id UUID REFERENCES folders(id),
  target_folder_id UUID REFERENCES folders(id),
  file_ids JSONB,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operations_user ON file_operations_log(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_type ON file_operations_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_operations_date ON file_operations_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_file_ids ON file_operations_log USING GIN(file_ids);

-- Add storage tracking to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT 107374182400;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "in_app": true}';

CREATE INDEX IF NOT EXISTS idx_users_storage ON users(storage_used_bytes);

-- ============================================
-- PHASE 3: METADATA TRACKING
-- ============================================

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS metadata_stripped BOOLEAN DEFAULT FALSE;

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS metadata_embedded JSONB DEFAULT NULL;

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS metadata_operations TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_media_metadata_operations ON media_files USING GIN(metadata_operations);
CREATE INDEX IF NOT EXISTS idx_media_metadata_embedded ON media_files(metadata_embedded) WHERE metadata_embedded IS NOT NULL;

-- ============================================
-- PHASE 4: STARRED/FAVORITES
-- ============================================

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS starred_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_media_files_starred
ON media_files(is_starred, starred_at DESC)
WHERE is_starred = TRUE AND is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_media_files_user_starred
ON media_files(uploaded_by, is_starred, starred_at DESC)
WHERE is_starred = TRUE AND is_deleted = FALSE;

-- ============================================
-- PHASE 5: COMMENTS SYSTEM
-- ============================================

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
-- PHASE 6: FILE REQUESTS
-- ============================================

CREATE TABLE IF NOT EXISTS file_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
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

CREATE INDEX IF NOT EXISTS idx_file_requests_token ON file_requests(request_token);
CREATE INDEX IF NOT EXISTS idx_file_requests_created_by ON file_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_file_requests_active ON file_requests(is_active) WHERE is_active = TRUE;

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

-- ============================================
-- PHASE 7: SMART COLLECTIONS
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
-- PHASE 8: PUBLIC LINK ENHANCEMENTS
-- ============================================

ALTER TABLE file_permissions
ADD COLUMN IF NOT EXISTS is_public_link BOOLEAN DEFAULT FALSE;

ALTER TABLE file_permissions
ADD COLUMN IF NOT EXISTS link_password VARCHAR(255);

ALTER TABLE file_permissions
ADD COLUMN IF NOT EXISTS link_expires_at TIMESTAMP;

ALTER TABLE file_permissions
ADD COLUMN IF NOT EXISTS disable_download BOOLEAN DEFAULT FALSE;

ALTER TABLE file_permissions
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

ALTER TABLE file_permissions
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP;

ALTER TABLE file_permissions
ADD COLUMN IF NOT EXISTS max_views INTEGER;

CREATE INDEX IF NOT EXISTS idx_file_permissions_public ON file_permissions(is_public_link) WHERE is_public_link = TRUE;
CREATE INDEX IF NOT EXISTS idx_file_permissions_expires ON file_permissions(link_expires_at) WHERE link_expires_at IS NOT NULL;

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
-- HELPER FUNCTIONS
-- ============================================

-- Function to get full folder path
CREATE OR REPLACE FUNCTION get_folder_path(folder_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
BEGIN
  WITH RECURSIVE folder_path AS (
    SELECT id, name, parent_folder_id, 1 as level
    FROM folders
    WHERE id = folder_uuid

    UNION ALL

    SELECT f.id, f.name, f.parent_folder_id, fp.level + 1
    FROM folders f
    INNER JOIN folder_path fp ON f.id = fp.parent_folder_id
  )
  SELECT string_agg(name, '/' ORDER BY level DESC) INTO result
  FROM folder_path;

  RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;

-- Function to update ad name hash
CREATE OR REPLACE FUNCTION update_ad_name_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ad_name_hash = encode(digest(NEW.ad_name, 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ad name hash
DROP TRIGGER IF EXISTS trigger_update_ad_name_hash ON facebook_ads;
CREATE TRIGGER trigger_update_ad_name_hash
BEFORE INSERT OR UPDATE OF ad_name ON facebook_ads
FOR EACH ROW
EXECUTE FUNCTION update_ad_name_hash();

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'editors', 'media_files', 'upload_tracking', 'access_logs',
    'facebook_campaigns', 'facebook_ads', 'ad_name_changes', 'facebook_auth',
    'analytics_cache', 'admin_audit_log', 'folders', 'file_permissions',
    'teams', 'team_members', 'upload_batches', 'file_operations_log',
    'file_comments', 'comment_reactions', 'file_requests', 'file_request_uploads',
    'saved_searches', 'public_link_access_log'
  );

  IF table_count = 24 THEN
    RAISE NOTICE '✅ MASTER MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '   Total tables created/verified: 24';
    RAISE NOTICE '';
    RAISE NOTICE '   Phase 1: Base Schema ✅';
    RAISE NOTICE '   Phase 2: Folders System ✅';
    RAISE NOTICE '   Phase 3: Metadata Tracking ✅';
    RAISE NOTICE '   Phase 4: Starred/Favorites ✅';
    RAISE NOTICE '   Phase 5: Comments System ✅';
    RAISE NOTICE '   Phase 6: File Requests ✅';
    RAISE NOTICE '   Phase 7: Smart Collections ✅';
    RAISE NOTICE '   Phase 8: Public Link Enhancements ✅';
    RAISE NOTICE '';
    RAISE NOTICE '   Your Creative Asset Library database is ready! 🚀';
  ELSE
    RAISE WARNING '⚠️  Expected 24 tables but found %', table_count;
    RAISE WARNING '   Please check the migration logs above for errors';
  END IF;
END $$;

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Run this with:
-- psql -U your_username -d creative_library -f MASTER_MIGRATION_ALL_FEATURES.sql
-- ============================================
