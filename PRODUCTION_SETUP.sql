-- ============================================
-- PRODUCTION DATABASE SETUP SCRIPT
-- Run this on your Render PostgreSQL database
-- ============================================

-- STEP 1: Add metadata tracking columns (if not exists)
-- This fixes the "column metadata_stripped does not exist" error
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS metadata_stripped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS metadata_embedded JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS metadata_operations TEXT[] DEFAULT '{}';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_metadata_operations
ON media_files USING GIN(metadata_operations);

CREATE INDEX IF NOT EXISTS idx_media_metadata_embedded
ON media_files(metadata_embedded)
WHERE metadata_embedded IS NOT NULL;

-- Update existing records to have empty array instead of null
UPDATE media_files
SET metadata_operations = '{}'
WHERE metadata_operations IS NULL;

COMMENT ON COLUMN media_files.metadata_stripped IS 'Whether original metadata was removed during upload';
COMMENT ON COLUMN media_files.metadata_embedded IS 'JSON object containing embedded metadata details';
COMMENT ON COLUMN media_files.metadata_operations IS 'Array of metadata operations performed';

-- ============================================
-- STEP 2: Bootstrap Admin User
-- ============================================

-- Add admin email to whitelist first
INSERT INTO allowed_emails (email, department, job_title, notes, is_active)
VALUES ('admin@creative-library.com', 'Administration', 'System Administrator', 'Default admin account', TRUE)
ON CONFLICT (email) DO UPDATE
SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP;

-- Note: You need to generate a bcrypt hash for the password
-- Run this on your local machine to generate the hash:
-- node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YourPassword123', 10, (err, hash) => console.log(hash));"

-- Then use the hash in the INSERT below
-- Example (DO NOT USE THIS HASH - generate your own):
INSERT INTO users (name, email, password_hash, role, is_active, upload_limit_monthly)
VALUES (
  'Admin User',
  'admin@creative-library.com',
  '$2b$10$REPLACE_THIS_WITH_YOUR_GENERATED_HASH',  -- Replace with actual bcrypt hash
  'admin',
  TRUE,
  9999
)
ON CONFLICT (email) DO UPDATE
SET is_active = TRUE, role = 'admin', updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- STEP 3: Verify Setup
-- ============================================

-- Check metadata columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'media_files'
AND column_name IN ('metadata_stripped', 'metadata_embedded', 'metadata_operations');

-- Check admin user exists
SELECT id, name, email, role, is_active, created_at
FROM users
WHERE email = 'admin@creative-library.com';

-- Check email is whitelisted
SELECT id, email, department, is_active
FROM allowed_emails
WHERE email = 'admin@creative-library.com';

-- ============================================
-- USAGE INSTRUCTIONS:
-- ============================================
--
-- 1. Connect to your Render PostgreSQL database:
--    - Go to Render Dashboard
--    - Navigate to your PostgreSQL service
--    - Click "Connect" → "External Connection"
--    - Use psql or a GUI client (TablePlus, DBeaver, etc.)
--
-- 2. Generate bcrypt hash for admin password:
--    cd /Users/mac/Desktop/creative-library/backend
--    node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('Admin@123', 10, (err, hash) => console.log(hash));"
--
-- 3. Copy the generated hash
--
-- 4. Replace the hash in STEP 2 above
--
-- 5. Run this entire script in your production database
--
-- 6. After running, you can login with:
--    Email: admin@creative-library.com
--    Password: (whatever password you used to generate the hash)
--
-- ============================================
