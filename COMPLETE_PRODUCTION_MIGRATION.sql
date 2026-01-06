-- ============================================
-- COMPLETE PRODUCTION MIGRATION SCRIPT
-- Run this ONCE on your Render PostgreSQL database
-- ============================================

-- This script is idempotent (safe to run multiple times)
-- Uses "IF NOT EXISTS" and "ADD COLUMN IF NOT EXISTS"

BEGIN;

-- ============================================
-- STEP 1: Add metadata tracking columns to media_files
-- ============================================

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS metadata_stripped BOOLEAN DEFAULT FALSE;

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS metadata_embedded JSONB DEFAULT NULL;

ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS metadata_operations TEXT[] DEFAULT '{}';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_metadata_operations
ON media_files USING GIN(metadata_operations);

CREATE INDEX IF NOT EXISTS idx_media_metadata_embedded
ON media_files(metadata_embedded)
WHERE metadata_embedded IS NOT NULL;

-- Update existing records
UPDATE media_files
SET metadata_operations = '{}'
WHERE metadata_operations IS NULL;

-- Add comments
COMMENT ON COLUMN media_files.metadata_stripped IS 'Whether original metadata was removed during upload';
COMMENT ON COLUMN media_files.metadata_embedded IS 'JSON object containing embedded metadata details';
COMMENT ON COLUMN media_files.metadata_operations IS 'Array of metadata operations performed';

-- ============================================
-- STEP 2: Add password reset columns to users table
-- ============================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_changed_by UUID REFERENCES users(id);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_users_password_changed_by
ON users(password_changed_by);

CREATE INDEX IF NOT EXISTS idx_users_password_changed_at
ON users(password_changed_at);

-- Add comments
COMMENT ON COLUMN users.password_changed_by IS 'Admin user ID who last changed this password';
COMMENT ON COLUMN users.password_changed_at IS 'Timestamp when password was last changed by admin';

-- ============================================
-- STEP 3: Create password_audit_log table
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_password_audit_user
ON password_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_password_audit_admin
ON password_audit_log(admin_id);

CREATE INDEX IF NOT EXISTS idx_password_audit_created
ON password_audit_log(created_at DESC);

-- Add comment
COMMENT ON TABLE password_audit_log IS 'Audit log for admin password reset actions';

-- ============================================
-- STEP 4: Verify all columns exist
-- ============================================

DO $$
DECLARE
  missing_columns TEXT := '';
BEGIN
  -- Check media_files columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_files' AND column_name = 'metadata_stripped'
  ) THEN
    missing_columns := missing_columns || 'media_files.metadata_stripped, ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_files' AND column_name = 'metadata_embedded'
  ) THEN
    missing_columns := missing_columns || 'media_files.metadata_embedded, ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_files' AND column_name = 'metadata_operations'
  ) THEN
    missing_columns := missing_columns || 'media_files.metadata_operations, ';
  END IF;

  -- Check users columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password_changed_by'
  ) THEN
    missing_columns := missing_columns || 'users.password_changed_by, ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password_changed_at'
  ) THEN
    missing_columns := missing_columns || 'users.password_changed_at, ';
  END IF;

  -- Check password_audit_log table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'password_audit_log'
  ) THEN
    missing_columns := missing_columns || 'password_audit_log table, ';
  END IF;

  IF LENGTH(missing_columns) > 0 THEN
    RAISE EXCEPTION 'Migration incomplete! Missing: %', missing_columns;
  ELSE
    RAISE NOTICE '✅ All required columns and tables exist!';
  END IF;
END $$;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- Run these after the migration to verify
-- ============================================

-- Check media_files columns
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'media_files'
AND column_name IN ('metadata_stripped', 'metadata_embedded', 'metadata_operations')
ORDER BY column_name;

-- Check users columns
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('password_changed_by', 'password_changed_at')
ORDER BY column_name;

-- Check password_audit_log table
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'password_audit_log'
ORDER BY ordinal_position;

-- Count existing data
SELECT
  'media_files' as table_name,
  COUNT(*) as row_count,
  COUNT(metadata_stripped) as has_metadata_stripped,
  COUNT(metadata_operations) as has_metadata_operations
FROM media_files
UNION ALL
SELECT
  'users' as table_name,
  COUNT(*) as row_count,
  COUNT(password_changed_by) as has_password_changed_by,
  COUNT(password_changed_at) as has_password_changed_at
FROM users;

-- ============================================
-- BOOTSTRAP ADMIN USER (Optional)
-- Only run if you need to create initial admin
-- ============================================

-- First, generate a password hash locally:
-- cd /Users/mac/Desktop/creative-library
-- node generate-password-hash.js "Admin@123"
-- Copy the hash output

-- Then uncomment and update the following:

/*
-- Add admin email to whitelist
INSERT INTO allowed_emails (email, department, job_title, notes, is_active)
VALUES ('admin@creative-library.com', 'Administration', 'System Administrator', 'Default admin', TRUE)
ON CONFLICT (email) DO UPDATE
SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP;

-- Create admin user (REPLACE THE HASH BELOW!)
INSERT INTO users (name, email, password_hash, role, is_active, upload_limit_monthly)
VALUES (
  'Admin User',
  'admin@creative-library.com',
  '$2b$10$REPLACE_WITH_YOUR_GENERATED_HASH',  -- IMPORTANT: Replace this!
  'admin',
  TRUE,
  9999
)
ON CONFLICT (email) DO UPDATE
SET is_active = TRUE, role = 'admin', updated_at = CURRENT_TIMESTAMP;
*/

-- ============================================
-- SUCCESS!
-- ============================================
-- After running this script:
-- 1. All file uploads should work (no metadata column errors)
-- 2. Password reset should work (no password_changed_by errors)
-- 3. Admin can create users
-- 4. System is production-ready
-- ============================================
