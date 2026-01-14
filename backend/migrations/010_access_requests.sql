-- Access Request System Migration
-- Allows users to request access to resources from owners/admins

-- =====================================================
-- 1. ACCESS REQUESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL, -- 'file_request', 'folder', 'media_file', 'canvas'
  resource_id UUID NOT NULL,
  requested_permission VARCHAR(50) NOT NULL, -- 'view', 'edit', 'download', etc.
  reason TEXT, -- Why they need access
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),

  -- Response tracking
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT, -- Admin can add notes when approving/denying

  -- Temporary access options
  expires_at TIMESTAMP, -- NULL = permanent, else temporary access

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Track if permission was granted when approved
  permission_granted BOOLEAN DEFAULT FALSE,
  granted_permission_id UUID REFERENCES permissions(id)
);

-- Prevent duplicate pending requests for same resource
CREATE UNIQUE INDEX idx_access_requests_unique_pending
  ON access_requests(requester_id, resource_type, resource_id, requested_permission)
  WHERE status = 'pending';

CREATE INDEX idx_access_requests_requester ON access_requests(requester_id);
CREATE INDEX idx_access_requests_resource ON access_requests(resource_type, resource_id);
CREATE INDEX idx_access_requests_status ON access_requests(status);
CREATE INDEX idx_access_requests_reviewer ON access_requests(reviewed_by);
CREATE INDEX idx_access_requests_created ON access_requests(created_at DESC);

-- =====================================================
-- 2. ACCESS REQUEST WATCHERS TABLE
-- =====================================================
-- Track who should be notified about access requests for specific resources
CREATE TABLE IF NOT EXISTS access_request_watchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_approve BOOLEAN DEFAULT TRUE, -- Can this watcher approve requests?
  notify_on_request BOOLEAN DEFAULT TRUE,
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource_type, resource_id, user_id)
);

CREATE INDEX idx_access_watchers_resource ON access_request_watchers(resource_type, resource_id);
CREATE INDEX idx_access_watchers_user ON access_request_watchers(user_id);

-- =====================================================
-- 3. FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_access_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for access_requests
CREATE TRIGGER update_access_requests_timestamp
  BEFORE UPDATE ON access_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_access_request_timestamp();

-- Function to automatically add resource owner as watcher
CREATE OR REPLACE FUNCTION add_resource_owner_as_watcher()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
BEGIN
  -- Find the resource owner based on resource type
  IF NEW.resource_type = 'folder' THEN
    SELECT owner_id INTO owner_id FROM folders WHERE id = NEW.resource_id;
  ELSIF NEW.resource_type = 'file_request' THEN
    SELECT created_by INTO owner_id FROM file_requests WHERE id = NEW.resource_id;
  ELSIF NEW.resource_type = 'media_file' THEN
    SELECT uploaded_by INTO owner_id FROM media_files WHERE id = NEW.resource_id;
  ELSIF NEW.resource_type = 'canvas' THEN
    SELECT created_by INTO owner_id FROM file_request_canvas WHERE id = NEW.resource_id;
  END IF;

  -- Add owner as watcher if found and not already watching
  IF owner_id IS NOT NULL THEN
    INSERT INTO access_request_watchers (resource_type, resource_id, user_id, can_approve, notify_on_request)
    VALUES (NEW.resource_type, NEW.resource_id, owner_id, TRUE, TRUE)
    ON CONFLICT (resource_type, resource_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to add owner as watcher when access request is created
CREATE TRIGGER add_owner_watcher_on_request
  AFTER INSERT ON access_requests
  FOR EACH ROW
  EXECUTE FUNCTION add_resource_owner_as_watcher();

-- =====================================================
-- 4. DEFAULT WATCHERS FOR EXISTING RESOURCES
-- =====================================================

-- Add folder owners as watchers for their folders
INSERT INTO access_request_watchers (resource_type, resource_id, user_id, can_approve)
SELECT 'folder', id, owner_id, TRUE
FROM folders
WHERE owner_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add file request creators as watchers
INSERT INTO access_request_watchers (resource_type, resource_id, user_id, can_approve)
SELECT 'file_request', id, created_by, TRUE
FROM file_requests
WHERE created_by IS NOT NULL
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. VIEWS FOR EASIER QUERYING
-- =====================================================

-- View to get access requests with user and resource details
CREATE OR REPLACE VIEW access_requests_detailed AS
SELECT
  ar.*,
  requester.name as requester_name,
  requester.email as requester_email,
  reviewer.name as reviewer_name,
  reviewer.email as reviewer_email,
  -- Resource name based on type
  CASE
    WHEN ar.resource_type = 'folder' THEN f.name
    WHEN ar.resource_type = 'file_request' THEN fr.name
    WHEN ar.resource_type = 'media_file' THEN mf.original_filename
    WHEN ar.resource_type = 'canvas' THEN frc.name
  END as resource_name,
  -- Resource owner
  CASE
    WHEN ar.resource_type = 'folder' THEN f.owner_id
    WHEN ar.resource_type = 'file_request' THEN fr.created_by
    WHEN ar.resource_type = 'media_file' THEN mf.uploaded_by
    WHEN ar.resource_type = 'canvas' THEN frc.created_by
  END as resource_owner_id
FROM access_requests ar
JOIN users requester ON ar.requester_id = requester.id
LEFT JOIN users reviewer ON ar.reviewed_by = reviewer.id
LEFT JOIN folders f ON ar.resource_type = 'folder' AND ar.resource_id = f.id
LEFT JOIN file_requests fr ON ar.resource_type = 'file_request' AND ar.resource_id = fr.id
LEFT JOIN media_files mf ON ar.resource_type = 'media_file' AND ar.resource_id = mf.id
LEFT JOIN file_request_canvas frc ON ar.resource_type = 'canvas' AND ar.resource_id = frc.id;

-- =====================================================
-- 6. COMMENTS
-- =====================================================

COMMENT ON TABLE access_requests IS 'User requests for access to resources';
COMMENT ON TABLE access_request_watchers IS 'Users who can approve access requests for specific resources';
COMMENT ON COLUMN access_requests.status IS 'pending: awaiting review, approved: access granted, denied: access refused, cancelled: requester cancelled';
COMMENT ON COLUMN access_requests.expires_at IS 'When granted access expires (NULL = permanent)';
COMMENT ON COLUMN access_request_watchers.can_approve IS 'Whether this watcher can approve/deny requests';
