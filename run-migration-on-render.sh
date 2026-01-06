#!/bin/bash

# ============================================
# Run this script from Render Shell
# ============================================
#
# HOW TO USE:
# 1. Go to Render Dashboard: https://dashboard.render.com
# 2. Click on your PostgreSQL service
# 3. Click "Shell" tab at the top
# 4. Copy and paste the SQL commands below
# 5. Press Enter to execute
#
# ============================================

# OR: If you have psql access locally with whitelisted IP:
# psql "postgresql://creative_library_user:dhEneE0oJmdC7hBJ0KQvQ85t9PECO5Uo@dpg-d45o9463jp1c73dma5sg-a.oregon-postgres.render.com/creative_library" -f COMPLETE_PRODUCTION_MIGRATION.sql

cat << 'EOF'

========================================
COPY EVERYTHING BELOW THIS LINE
Paste into Render PostgreSQL Shell
========================================

BEGIN;

-- Add metadata tracking columns to media_files
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

-- Add password reset columns to users table
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

-- Create password_audit_log table
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

-- Verify all columns exist
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

========================================
MIGRATION COMPLETE!
If you see: "✅ All required columns and tables exist!"
Then production is fixed!
========================================

EOF
