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
