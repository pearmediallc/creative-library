-- =====================================================
-- Complete RBAC Enhancements Migration
-- Includes all phases: Comments, Folder Access, Permissions
-- =====================================================

-- Phase 1: File Request Comments (Phase 5)
CREATE TABLE IF NOT EXISTS file_request_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_request_comments_request ON file_request_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_request_comments_user ON file_request_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_request_comments_created ON file_request_comments(created_at DESC);

-- Trigger for comment timestamp updates
CREATE OR REPLACE FUNCTION update_request_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_request_comment_timestamp ON file_request_comments;
CREATE TRIGGER update_request_comment_timestamp
BEFORE UPDATE ON file_request_comments
FOR EACH ROW
EXECUTE FUNCTION update_request_comment_timestamp();

-- Phase 2: Folder Access Granting (Phase 4)
-- Add granted_by_folder_owner column to permissions table
ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS granted_by_folder_owner BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_permissions_folder_owner ON permissions(granted_by_folder_owner) WHERE granted_by_folder_owner = TRUE;

-- Verify migrations
SELECT 'RBAC Enhancements migration completed successfully!' AS status;

-- Show created tables and columns
SELECT
  'file_request_comments table' as feature,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'file_request_comments'
UNION ALL
SELECT
  'permissions.granted_by_folder_owner column' as feature,
  COUNT(*) as exists
FROM information_schema.columns
WHERE table_name = 'permissions' AND column_name = 'granted_by_folder_owner';
