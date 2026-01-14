-- =====================================================
-- HOTFIX: Add missing RBAC columns
-- =====================================================

-- Add missing columns to user_roles table
ALTER TABLE user_roles
ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add missing columns to folder_admins table
ALTER TABLE folder_admins
ADD COLUMN IF NOT EXISTS can_grant_access BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_revoke_access BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_manage_requests BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_delete_files BOOLEAN DEFAULT FALSE;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_roles_granted_by ON user_roles(granted_by);
CREATE INDEX IF NOT EXISTS idx_folder_admins_permissions ON folder_admins(user_id, folder_id) WHERE is_active = TRUE;

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_roles'
  AND column_name IN ('granted_by', 'granted_at')
ORDER BY column_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'folder_admins'
  AND column_name IN ('can_grant_access', 'can_revoke_access', 'can_manage_requests', 'can_delete_files')
ORDER BY column_name;

-- Show success message
SELECT 'HOTFIX applied successfully! Missing columns added.' AS status;
