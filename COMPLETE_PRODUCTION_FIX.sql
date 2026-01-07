-- ============================================
-- COMPLETE PRODUCTION DATABASE FIX
-- Run this ONCE on production Render PostgreSQL
-- ============================================

-- This script fixes ALL issues reported by the user:
-- 1. relation "teams" does not exist
-- 2. relation "folders" does not exist
-- 3. column "parent_file_id" does not exist

BEGIN;

-- ============================================
-- STEP 1: Create folders table
-- ============================================

CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  name VARCHAR(255) NOT NULL,
  parent_folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Organization
  is_auto_created BOOLEAN DEFAULT FALSE,
  folder_type VARCHAR(50) DEFAULT 'user',

  -- Metadata
  description TEXT,
  color VARCHAR(20),

  -- S3 path tracking
  s3_path TEXT,

  -- Soft delete
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_folder_name_per_parent UNIQUE(parent_folder_id, name, owner_id)
);

-- Indexes for folders
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_not_deleted ON folders(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders USING btree(parent_folder_id, name);
CREATE INDEX IF NOT EXISTS idx_folders_type ON folders(folder_type);

COMMENT ON TABLE folders IS 'Hierarchical folder structure for organizing media files';

-- ============================================
-- STEP 2: Create teams tables
-- ============================================

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

COMMENT ON TABLE teams IS 'Teams for collaborative file sharing';

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- owner, admin, member, viewer
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

COMMENT ON TABLE team_members IS 'Team membership and roles';

-- ============================================
-- STEP 3: Add folder/version support to media_files
-- ============================================

-- Add folder_id column
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- Add upload batch tracking
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS upload_batch_id UUID;

-- Add buyer assignment
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS assigned_buyer_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add version tracking (THIS IS THE CRITICAL MISSING COLUMN!)
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS parent_file_id UUID REFERENCES media_files(id);

-- Add metadata tracking
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS metadata_stripped BOOLEAN DEFAULT FALSE;

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS metadata_embedded JSONB DEFAULT NULL;

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS metadata_operations TEXT[] DEFAULT '{}';

-- Indexes for media_files
CREATE INDEX IF NOT EXISTS idx_media_folder ON media_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_media_batch ON media_files(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_media_buyer ON media_files(assigned_buyer_id);
CREATE INDEX IF NOT EXISTS idx_media_parent ON media_files(parent_file_id);
CREATE INDEX IF NOT EXISTS idx_media_version ON media_files(version_number);
CREATE INDEX IF NOT EXISTS idx_media_metadata_operations ON media_files USING GIN(metadata_operations);
CREATE INDEX IF NOT EXISTS idx_media_metadata_embedded ON media_files(metadata_embedded) WHERE metadata_embedded IS NOT NULL;

COMMENT ON COLUMN media_files.folder_id IS 'Folder this file belongs to (NULL = root)';
COMMENT ON COLUMN media_files.parent_file_id IS 'Parent file ID for versioning system';
COMMENT ON COLUMN media_files.version_number IS 'Version number (1, 2, 3, etc.)';
COMMENT ON COLUMN media_files.metadata_stripped IS 'Whether original metadata was removed during upload';
COMMENT ON COLUMN media_files.metadata_embedded IS 'JSON object containing embedded metadata details';

-- Update existing records
UPDATE media_files
SET metadata_operations = '{}'
WHERE metadata_operations IS NULL;

-- ============================================
-- STEP 4: Create file permissions table
-- ============================================

CREATE TABLE IF NOT EXISTS file_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Resource (file or folder)
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NOT NULL,

  -- Grantee (user or team)
  grantee_type VARCHAR(50) NOT NULL,
  grantee_id UUID NOT NULL,

  -- Permission
  permission_type VARCHAR(50) NOT NULL,

  -- Audit
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,

  UNIQUE(resource_type, resource_id, grantee_type, grantee_id, permission_type)
);

CREATE INDEX IF NOT EXISTS idx_permissions_resource ON file_permissions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_permissions_grantee ON file_permissions(grantee_type, grantee_id);
CREATE INDEX IF NOT EXISTS idx_permissions_expires ON file_permissions(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE file_permissions IS 'Granular access control for files and folders';

-- ============================================
-- STEP 5: Create upload batches table
-- ============================================

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

COMMENT ON TABLE upload_batches IS 'Track multi-file upload operations';

-- ============================================
-- STEP 6: Create file operations log
-- ============================================

CREATE TABLE IF NOT EXISTS file_operations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  operation_type VARCHAR(50) NOT NULL,

  -- Operation details
  source_folder_id UUID REFERENCES folders(id),
  target_folder_id UUID REFERENCES folders(id),
  file_ids JSONB,

  -- Context
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operations_user ON file_operations_log(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_type ON file_operations_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_operations_date ON file_operations_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_file_ids ON file_operations_log USING GIN(file_ids);

COMMENT ON TABLE file_operations_log IS 'Audit trail for all file operations';

-- ============================================
-- STEP 7: Update users table
-- ============================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT 107374182400; -- 100GB

ALTER TABLE users
ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "in_app": true}';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_changed_by UUID REFERENCES users(id);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_storage ON users(storage_used_bytes);
CREATE INDEX IF NOT EXISTS idx_users_password_changed_by ON users(password_changed_by);
CREATE INDEX IF NOT EXISTS idx_users_password_changed_at ON users(password_changed_at);

COMMENT ON COLUMN users.storage_quota_bytes IS 'Total storage quota in bytes (default 100GB)';
COMMENT ON COLUMN users.storage_used_bytes IS 'Current storage usage in bytes';
COMMENT ON COLUMN users.password_changed_by IS 'Admin user ID who last changed this password';
COMMENT ON COLUMN users.password_changed_at IS 'Timestamp when password was last changed by admin';

-- ============================================
-- STEP 8: Create password audit log
-- ============================================

CREATE TABLE IF NOT EXISTS password_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL DEFAULT 'reset',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_audit_user ON password_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_password_audit_admin ON password_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_password_audit_created ON password_audit_log(created_at DESC);

COMMENT ON TABLE password_audit_log IS 'Audit log for admin password reset actions';

-- ============================================
-- STEP 9: Create helper function for folder paths
-- ============================================

CREATE OR REPLACE FUNCTION get_folder_path(folder_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
BEGIN
  -- Build path from bottom to top
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

COMMENT ON FUNCTION get_folder_path IS 'Returns full folder path like "parent/child/grandchild"';

-- ============================================
-- STEP 10: Verify migration
-- ============================================

DO $$
DECLARE
  missing_items TEXT := '';
BEGIN
  -- Check tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'folders') THEN
    missing_items := missing_items || 'folders table, ';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
    missing_items := missing_items || 'teams table, ';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
    missing_items := missing_items || 'team_members table, ';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'file_permissions') THEN
    missing_items := missing_items || 'file_permissions table, ';
  END IF;

  -- Check critical columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_files' AND column_name = 'parent_file_id'
  ) THEN
    missing_items := missing_items || 'media_files.parent_file_id, ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_files' AND column_name = 'folder_id'
  ) THEN
    missing_items := missing_items || 'media_files.folder_id, ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_files' AND column_name = 'version_number'
  ) THEN
    missing_items := missing_items || 'media_files.version_number, ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_files' AND column_name = 'metadata_stripped'
  ) THEN
    missing_items := missing_items || 'media_files.metadata_stripped, ';
  END IF;

  IF LENGTH(missing_items) > 0 THEN
    RAISE EXCEPTION '❌ Migration incomplete! Missing: %', missing_items;
  ELSE
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ PRODUCTION DATABASE MIGRATION COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE ' ';
    RAISE NOTICE '✅ folders table created';
    RAISE NOTICE '✅ teams and team_members tables created';
    RAISE NOTICE '✅ file_permissions table created';
    RAISE NOTICE '✅ upload_batches table created';
    RAISE NOTICE '✅ file_operations_log table created';
    RAISE NOTICE '✅ password_audit_log table created';
    RAISE NOTICE ' ';
    RAISE NOTICE '✅ media_files.folder_id added';
    RAISE NOTICE '✅ media_files.parent_file_id added (VERSION SUPPORT!)';
    RAISE NOTICE '✅ media_files.version_number added';
    RAISE NOTICE '✅ media_files.metadata_stripped added';
    RAISE NOTICE '✅ media_files.metadata_embedded added';
    RAISE NOTICE ' ';
    RAISE NOTICE '✅ users.storage_quota_bytes added';
    RAISE NOTICE '✅ users.password_changed_by added';
    RAISE NOTICE ' ';
    RAISE NOTICE 'All reported errors should now be fixed:';
    RAISE NOTICE '  - relation "teams" does not exist ✅ FIXED';
    RAISE NOTICE '  - relation "folders" does not exist ✅ FIXED';
    RAISE NOTICE '  - column "parent_file_id" does not exist ✅ FIXED';
    RAISE NOTICE ' ';
    RAISE NOTICE '========================================';
  END IF;
END $$;

COMMIT;

-- ============================================
-- SUCCESS! Your production database is now fixed.
-- ============================================
