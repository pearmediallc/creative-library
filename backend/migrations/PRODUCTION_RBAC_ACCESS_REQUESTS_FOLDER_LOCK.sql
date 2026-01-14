-- =====================================================
-- PRODUCTION MIGRATION: RBAC + Access Requests + Folder Lock
-- Run this on production database
-- =====================================================

-- Check PostgreSQL version (should be 12+)
SELECT version();

-- =====================================================
-- 1. RBAC SYSTEM (009_rbac_system.sql)
-- =====================================================

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user_roles table with partial unique indexes
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope_type VARCHAR(50) NOT NULL,
  scope_id UUID,
  expires_at TIMESTAMP,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Partial unique indexes for user_roles
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_unique_with_scope
  ON user_roles(user_id, role_id, scope_type, scope_id)
  WHERE scope_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_unique_without_scope
  ON user_roles(user_id, role_id, scope_type)
  WHERE scope_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_scope ON user_roles(scope_type, scope_id);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  action VARCHAR(50) NOT NULL,
  permission VARCHAR(20) NOT NULL CHECK (permission IN ('allow', 'deny')),
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  reason TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Partial unique indexes for permissions
CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_unique_with_resource
  ON permissions(user_id, resource_type, resource_id, action)
  WHERE resource_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_unique_without_resource
  ON permissions(user_id, resource_type, action)
  WHERE resource_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_permissions_user ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_permissions_active ON permissions(is_active, expires_at);

-- Create folder_admins table
CREATE TABLE IF NOT EXISTS folder_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT TRUE,
  can_upload BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT TRUE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_share BOOLEAN DEFAULT FALSE,
  can_manage_permissions BOOLEAN DEFAULT FALSE,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, folder_id)
);

CREATE INDEX IF NOT EXISTS idx_folder_admins_user ON folder_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_folder_admins_folder ON folder_admins(folder_id);

-- Create permission_audit_log table
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type VARCHAR(50) NOT NULL,
  performed_by UUID REFERENCES users(id),
  target_user_id UUID REFERENCES users(id),
  resource_type VARCHAR(50),
  resource_id UUID,
  permission_granted VARCHAR(20),
  role_assigned VARCHAR(50),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON permission_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_target_user ON permission_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON permission_audit_log(created_at DESC);

-- Create ui_permissions table
CREATE TABLE IF NOT EXISTS ui_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ui_element VARCHAR(100) NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  is_enabled BOOLEAN DEFAULT TRUE,
  custom_label VARCHAR(255),
  set_by UUID REFERENCES users(id),
  set_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, ui_element)
);

CREATE INDEX IF NOT EXISTS idx_ui_permissions_user ON ui_permissions(user_id);

-- Create default_role_permissions table
CREATE TABLE IF NOT EXISTS default_role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  permission VARCHAR(20) NOT NULL CHECK (permission IN ('allow', 'deny')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, resource_type, action)
);

CREATE INDEX IF NOT EXISTS idx_default_role_perms_role ON default_role_permissions(role_id);

-- Insert default system roles
INSERT INTO roles (name, description, is_system_role) VALUES
  ('Super Admin', 'Full system access with all permissions', TRUE),
  ('Admin', 'Administrative access to most features', TRUE),
  ('Buyer', 'Can create file requests and view assigned files', TRUE),
  ('Editor', 'Can upload and edit media files', TRUE),
  ('Viewer', 'Read-only access to shared resources', TRUE)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. ACCESS REQUESTS SYSTEM (010_access_requests.sql)
-- =====================================================

CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NOT NULL,
  requested_permission VARCHAR(50) NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  permission_granted BOOLEAN DEFAULT FALSE,
  granted_permission_id UUID REFERENCES permissions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_unique_pending
  ON access_requests(requester_id, resource_type, resource_id, requested_permission)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_access_requests_requester ON access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_resource ON access_requests(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_reviewer ON access_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_access_requests_created ON access_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS access_request_watchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_approve BOOLEAN DEFAULT TRUE,
  notify_on_request BOOLEAN DEFAULT TRUE,
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource_type, resource_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_access_watchers_resource ON access_request_watchers(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_access_watchers_user ON access_request_watchers(user_id);

-- Function to update access_request timestamp
CREATE OR REPLACE FUNCTION update_access_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_access_requests_timestamp ON access_requests;
CREATE TRIGGER update_access_requests_timestamp
  BEFORE UPDATE ON access_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_access_request_timestamp();

-- Function to add resource owner as watcher
CREATE OR REPLACE FUNCTION add_resource_owner_as_watcher()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
BEGIN
  IF NEW.resource_type = 'folder' THEN
    SELECT owner_id INTO owner_id FROM folders WHERE id = NEW.resource_id;
  ELSIF NEW.resource_type = 'file_request' THEN
    SELECT created_by INTO owner_id FROM file_requests WHERE id = NEW.resource_id;
  ELSIF NEW.resource_type = 'media_file' THEN
    SELECT uploaded_by INTO owner_id FROM media_files WHERE id = NEW.resource_id;
  ELSIF NEW.resource_type = 'canvas' THEN
    SELECT created_by INTO owner_id FROM file_request_canvas WHERE id = NEW.resource_id;
  END IF;

  IF owner_id IS NOT NULL THEN
    INSERT INTO access_request_watchers (resource_type, resource_id, user_id, can_approve, notify_on_request)
    VALUES (NEW.resource_type, NEW.resource_id, owner_id, TRUE, TRUE)
    ON CONFLICT (resource_type, resource_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS add_owner_watcher_on_request ON access_requests;
CREATE TRIGGER add_owner_watcher_on_request
  AFTER INSERT ON access_requests
  FOR EACH ROW
  EXECUTE FUNCTION add_resource_owner_as_watcher();

-- Add watchers for existing resources
INSERT INTO access_request_watchers (resource_type, resource_id, user_id, can_approve)
SELECT 'folder', id, owner_id, TRUE
FROM folders
WHERE owner_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO access_request_watchers (resource_type, resource_id, user_id, can_approve)
SELECT 'file_request', id, created_by, TRUE
FROM file_requests
WHERE created_by IS NOT NULL
ON CONFLICT DO NOTHING;

-- Create view for access requests with details
CREATE OR REPLACE VIEW access_requests_detailed AS
SELECT
  ar.*,
  requester.name as requester_name,
  requester.email as requester_email,
  reviewer.name as reviewer_name,
  reviewer.email as reviewer_email,
  CASE
    WHEN ar.resource_type = 'folder' THEN f.name
    WHEN ar.resource_type = 'file_request' THEN CONCAT('File Request #', SUBSTRING(ar.resource_id::text, 1, 8))
    WHEN ar.resource_type = 'media_file' THEN mf.original_filename
    WHEN ar.resource_type = 'canvas' THEN CONCAT('Canvas for Request #', SUBSTRING(frc.file_request_id::text, 1, 8))
  END as resource_name,
  CASE
    WHEN ar.resource_type = 'folder' THEN f.owner_id
    WHEN ar.resource_type = 'file_request' THEN fr.created_by
    WHEN ar.resource_type = 'media_file' THEN mf.uploaded_by
    WHEN ar.resource_type = 'canvas' THEN fr_canvas.created_by
  END as resource_owner_id
FROM access_requests ar
JOIN users requester ON ar.requester_id = requester.id
LEFT JOIN users reviewer ON ar.reviewed_by = reviewer.id
LEFT JOIN folders f ON ar.resource_type = 'folder' AND ar.resource_id = f.id
LEFT JOIN file_requests fr ON ar.resource_type = 'file_request' AND ar.resource_id = fr.id
LEFT JOIN media_files mf ON ar.resource_type = 'media_file' AND ar.resource_id = mf.id
LEFT JOIN file_request_canvas frc ON ar.resource_type = 'canvas' AND ar.resource_id = frc.id
LEFT JOIN file_requests fr_canvas ON frc.file_request_id = fr_canvas.id;

-- =====================================================
-- 3. FOLDER LOCK FEATURE
-- =====================================================

-- Add is_locked column to folders table
ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id);
ALTER TABLE folders ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS lock_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_folders_locked ON folders(is_locked) WHERE is_locked = TRUE;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify RBAC tables
SELECT 'RBAC Tables' as check_type,
       COUNT(*) as role_count
FROM roles;

SELECT 'User Roles' as check_type,
       COUNT(*) as count
FROM user_roles;

-- Verify Access Request tables
SELECT 'Access Request Tables' as check_type,
       'access_requests' as table_name,
       COUNT(*) as count
FROM access_requests
UNION ALL
SELECT 'Access Request Tables',
       'access_request_watchers',
       COUNT(*)
FROM access_request_watchers;

-- Verify Folder Lock
SELECT 'Folder Lock Column' as check_type,
       COUNT(*) as folders_with_column
FROM information_schema.columns
WHERE table_name = 'folders' AND column_name = 'is_locked';

-- Show summary
SELECT 'MIGRATION COMPLETE' as status,
       NOW() as completed_at;
