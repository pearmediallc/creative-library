-- ============================================
-- CONSOLIDATED MIGRATION FOR ALL NEW FEATURES
-- ============================================
-- Date: 2024-01-13
-- Features: Comments, File Requests, Smart Collections, Public Link Enhancements
-- Run this migration to enable all new features at once
-- ============================================

-- ============================================
-- 1. COMMENTS SYSTEM
-- ============================================

-- Comments table
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

-- Comment reactions table
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
-- 2. FILE REQUESTS
-- ============================================

-- File requests table
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

-- Uploaded files for requests
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
-- 3. SMART COLLECTIONS (SAVED SEARCHES)
-- ============================================

-- Saved searches / smart collections
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
-- 4. PUBLIC LINK SHARING ENHANCEMENTS
-- ============================================

-- Add columns to file_permissions table for public link features
ALTER TABLE file_permissions
ADD COLUMN IF NOT EXISTS is_public_link BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS link_password VARCHAR(255),
ADD COLUMN IF NOT EXISTS link_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS disable_download BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS max_views INTEGER;

-- Index for public links
CREATE INDEX IF NOT EXISTS idx_file_permissions_public ON file_permissions(is_public_link) WHERE is_public_link = TRUE;
CREATE INDEX IF NOT EXISTS idx_file_permissions_expires ON file_permissions(link_expires_at) WHERE link_expires_at IS NOT NULL;

-- Public link access log
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
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify all tables were created successfully:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('file_comments', 'comment_reactions', 'file_requests', 'file_request_uploads', 'saved_searches', 'public_link_access_log')
-- ORDER BY table_name;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- All tables and indexes created successfully!
-- You can now restart your backend server to use the new features.
-- ============================================
