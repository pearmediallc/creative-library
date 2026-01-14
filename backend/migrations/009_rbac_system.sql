-- RBAC (Role-Based Access Control) System Migration
-- This creates a comprehensive permission system with:
-- 1. Roles - Template permission sets
-- 2. User Roles - Assign roles to users
-- 3. Permissions - Granular permission control
-- 4. Folder Admins - Folder-level administration
-- 5. UI Permissions - Control UI element visibility

-- =====================================================
-- 1. ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE, -- System roles can't be deleted
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create default system roles
INSERT INTO roles (name, description, is_system_role) VALUES
  ('Super Admin', 'Full system access - can manage all users, permissions, and resources', TRUE),
  ('Admin', 'Administrative access - can manage users and most resources', TRUE),
  ('Buyer', 'Can create file requests and manage assigned folders', TRUE),
  ('Editor', 'Can upload files and view assigned requests', TRUE),
  ('Viewer', 'Read-only access to assigned resources', TRUE),
  ('Guest', 'Limited access for temporary users', TRUE);

-- =====================================================
-- 2. USER ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope_type VARCHAR(50), -- 'global', 'folder', 'request'
  scope_id UUID, -- Reference to folder_id or request_id
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- NULL = no expiration
  is_active BOOLEAN DEFAULT TRUE
);

-- Unique constraint that handles NULL scope_id properly
CREATE UNIQUE INDEX idx_user_roles_unique_with_scope
  ON user_roles(user_id, role_id, scope_type, scope_id)
  WHERE scope_id IS NOT NULL;

CREATE UNIQUE INDEX idx_user_roles_unique_without_scope
  ON user_roles(user_id, role_id, scope_type)
  WHERE scope_id IS NULL;

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_scope ON user_roles(scope_type, scope_id);
CREATE INDEX idx_user_roles_expiration ON user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- =====================================================
-- 3. PERMISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL, -- 'file_request', 'folder', 'media_file', 'canvas', 'user', 'analytics'
  resource_id UUID, -- NULL = applies to all resources of this type
  action VARCHAR(50) NOT NULL, -- 'view', 'create', 'edit', 'delete', 'assign', 'download', 'upload', 'share'
  permission VARCHAR(10) NOT NULL CHECK (permission IN ('allow', 'deny')), -- 'allow' or 'deny'
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- NULL = no expiration
  reason TEXT, -- Why this permission was granted/denied
  is_active BOOLEAN DEFAULT TRUE
);

-- Unique constraint for permissions that handles NULL resource_id
CREATE UNIQUE INDEX idx_permissions_unique_with_resource
  ON permissions(user_id, resource_type, resource_id, action)
  WHERE resource_id IS NOT NULL;

CREATE UNIQUE INDEX idx_permissions_unique_without_resource
  ON permissions(user_id, resource_type, action)
  WHERE resource_id IS NULL;

CREATE INDEX idx_permissions_user ON permissions(user_id);
CREATE INDEX idx_permissions_resource ON permissions(resource_type, resource_id);
CREATE INDEX idx_permissions_action ON permissions(action);
CREATE INDEX idx_permissions_expiration ON permissions(expires_at) WHERE expires_at IS NOT NULL;

-- =====================================================
-- 4. FOLDER ADMINS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS folder_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_grant_access BOOLEAN DEFAULT TRUE, -- Can assign users to folder
  can_revoke_access BOOLEAN DEFAULT TRUE, -- Can remove users from folder
  can_manage_requests BOOLEAN DEFAULT TRUE, -- Can manage file requests in folder
  can_delete_files BOOLEAN DEFAULT FALSE, -- Can delete files in folder
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- NULL = no expiration
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(folder_id, user_id)
);

CREATE INDEX idx_folder_admins_folder ON folder_admins(folder_id);
CREATE INDEX idx_folder_admins_user ON folder_admins(user_id);
CREATE INDEX idx_folder_admins_expiration ON folder_admins(expires_at) WHERE expires_at IS NOT NULL;

-- =====================================================
-- 5. UI PERMISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ui_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ui_element VARCHAR(100) NOT NULL, -- 'dashboard', 'file_requests', 'media_library', 'canvas', 'analytics', 'admin_panel'
  is_visible BOOLEAN DEFAULT TRUE,
  is_enabled BOOLEAN DEFAULT TRUE, -- Visible but disabled/grayed out
  custom_label VARCHAR(255), -- Custom label for this user
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, ui_element)
);

CREATE INDEX idx_ui_permissions_user ON ui_permissions(user_id);
CREATE INDEX idx_ui_permissions_element ON ui_permissions(ui_element);

-- =====================================================
-- 6. PERMISSION AUDIT LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type VARCHAR(50) NOT NULL, -- 'role_assigned', 'role_revoked', 'permission_granted', 'permission_denied', 'folder_admin_added', 'folder_admin_removed'
  performed_by UUID NOT NULL REFERENCES users(id),
  target_user_id UUID REFERENCES users(id), -- User affected by the action
  resource_type VARCHAR(50), -- 'role', 'permission', 'folder_admin', 'ui_permission'
  resource_id UUID, -- ID of the role/permission/folder_admin record
  details JSONB, -- Full details of what changed
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_permission_audit_performer ON permission_audit_log(performed_by);
CREATE INDEX idx_permission_audit_target ON permission_audit_log(target_user_id);
CREATE INDEX idx_permission_audit_created ON permission_audit_log(created_at);

-- =====================================================
-- 7. DEFAULT ROLE PERMISSIONS (Reference Data)
-- =====================================================
-- This table defines what permissions each role should have by default
CREATE TABLE IF NOT EXISTS role_default_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  permission VARCHAR(10) NOT NULL CHECK (permission IN ('allow', 'deny')),
  UNIQUE(role_id, resource_type, action)
);

CREATE INDEX idx_role_default_permissions_role ON role_default_permissions(role_id);

-- =====================================================
-- 8. POPULATE DEFAULT ROLE PERMISSIONS
-- =====================================================

-- Super Admin: Full access to everything
INSERT INTO role_default_permissions (role_id, resource_type, action, permission)
SELECT id, resource_type, action, 'allow'
FROM roles,
  (VALUES
    ('file_request'), ('folder'), ('media_file'), ('canvas'), ('user'), ('analytics'), ('admin_panel')
  ) AS resources(resource_type),
  (VALUES
    ('view'), ('create'), ('edit'), ('delete'), ('assign'), ('download'), ('upload'), ('share'), ('manage')
  ) AS actions(action)
WHERE roles.name = 'Super Admin';

-- Admin: Most access except user management
INSERT INTO role_default_permissions (role_id, resource_type, action, permission)
SELECT r.id, rp.resource_type, rp.action, 'allow'
FROM roles r,
  (VALUES
    ('file_request', 'view'), ('file_request', 'create'), ('file_request', 'edit'), ('file_request', 'delete'), ('file_request', 'assign'),
    ('folder', 'view'), ('folder', 'create'), ('folder', 'edit'),
    ('media_file', 'view'), ('media_file', 'upload'), ('media_file', 'download'), ('media_file', 'delete'),
    ('canvas', 'view'), ('canvas', 'create'), ('canvas', 'edit'),
    ('analytics', 'view'),
    ('user', 'view')
  ) AS rp(resource_type, action)
WHERE r.name = 'Admin';

-- Buyer: Can manage file requests and folders
INSERT INTO role_default_permissions (role_id, resource_type, action, permission)
SELECT r.id, rp.resource_type, rp.action, 'allow'
FROM roles r,
  (VALUES
    ('file_request', 'view'), ('file_request', 'create'), ('file_request', 'edit'), ('file_request', 'assign'),
    ('folder', 'view'), ('folder', 'create'),
    ('media_file', 'view'), ('media_file', 'download'),
    ('canvas', 'view'), ('canvas', 'create'), ('canvas', 'edit'),
    ('analytics', 'view')
  ) AS rp(resource_type, action)
WHERE r.name = 'Buyer';

-- Editor: Can upload files and view requests
INSERT INTO role_default_permissions (role_id, resource_type, action, permission)
SELECT r.id, rp.resource_type, rp.action, 'allow'
FROM roles r,
  (VALUES
    ('file_request', 'view'),
    ('folder', 'view'),
    ('media_file', 'view'), ('media_file', 'upload'), ('media_file', 'download'),
    ('canvas', 'view')
  ) AS rp(resource_type, action)
WHERE r.name = 'Editor';

-- Viewer: Read-only access
INSERT INTO role_default_permissions (role_id, resource_type, action, permission)
SELECT r.id, rp.resource_type, rp.action, 'allow'
FROM roles r,
  (VALUES
    ('file_request', 'view'),
    ('folder', 'view'),
    ('media_file', 'view'), ('media_file', 'download'),
    ('canvas', 'view')
  ) AS rp(resource_type, action)
WHERE r.name = 'Viewer';

-- Guest: Very limited access
INSERT INTO role_default_permissions (role_id, resource_type, action, permission)
SELECT r.id, rp.resource_type, rp.action, 'allow'
FROM roles r,
  (VALUES
    ('file_request', 'view'),
    ('media_file', 'view')
  ) AS rp(resource_type, action)
WHERE r.name = 'Guest';

-- =====================================================
-- 9. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for roles table
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically deactivate expired permissions
CREATE OR REPLACE FUNCTION deactivate_expired_permissions()
RETURNS void AS $$
BEGIN
  -- Deactivate expired user roles
  UPDATE user_roles
  SET is_active = FALSE
  WHERE expires_at IS NOT NULL
    AND expires_at < CURRENT_TIMESTAMP
    AND is_active = TRUE;

  -- Deactivate expired permissions
  UPDATE permissions
  SET is_active = FALSE
  WHERE expires_at IS NOT NULL
    AND expires_at < CURRENT_TIMESTAMP
    AND is_active = TRUE;

  -- Deactivate expired folder admins
  UPDATE folder_admins
  SET is_active = FALSE
  WHERE expires_at IS NOT NULL
    AND expires_at < CURRENT_TIMESTAMP
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. INITIAL DATA SETUP
-- =====================================================

-- Assign Super Admin role to existing admin users (customize this as needed)
-- This assumes users with role='admin' in the users table should be Super Admins
INSERT INTO user_roles (user_id, role_id, scope_type, granted_by)
SELECT u.id, r.id, 'global', u.id
FROM users u
CROSS JOIN roles r
WHERE u.role = 'admin'
  AND r.name = 'Super Admin'
ON CONFLICT (user_id, role_id, scope_type, scope_id) DO NOTHING;

-- Assign Buyer role to existing buyers
INSERT INTO user_roles (user_id, role_id, scope_type, granted_by)
SELECT u.id, r.id, 'global', u.id
FROM users u
CROSS JOIN roles r
WHERE u.role = 'buyer'
  AND r.name = 'Buyer'
ON CONFLICT (user_id, role_id, scope_type, scope_id) DO NOTHING;

-- =====================================================
-- 11. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE roles IS 'Role templates with predefined permission sets';
COMMENT ON TABLE user_roles IS 'Assigns roles to users with optional scoping and expiration';
COMMENT ON TABLE permissions IS 'Granular permission grants/denies for specific resources and actions';
COMMENT ON TABLE folder_admins IS 'Users who can administer specific folders';
COMMENT ON TABLE ui_permissions IS 'Controls visibility and state of UI elements per user';
COMMENT ON TABLE permission_audit_log IS 'Audit trail of all permission changes';
COMMENT ON TABLE role_default_permissions IS 'Default permissions for each role';

COMMENT ON COLUMN user_roles.scope_type IS 'Scope of role assignment: global, folder, or request';
COMMENT ON COLUMN user_roles.scope_id IS 'ID of the folder or request this role applies to';
COMMENT ON COLUMN permissions.permission IS 'allow or deny - deny takes precedence';
COMMENT ON COLUMN permissions.resource_id IS 'NULL means permission applies to all resources of this type';
COMMENT ON COLUMN folder_admins.can_grant_access IS 'Can assign users to this folder';
COMMENT ON COLUMN ui_permissions.is_enabled IS 'If false, element is visible but disabled/grayed out';
