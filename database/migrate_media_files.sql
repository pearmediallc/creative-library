-- ============================================
-- MIGRATION: Rebuild media_files table
-- Run this on production database to fix schema
-- ============================================

-- Drop existing media_files table and recreate with correct schema
DROP TABLE IF EXISTS media_files CASCADE;

-- Recreate media_files table with production-ready schema
CREATE TABLE media_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- File Info
  filename VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  s3_url TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  thumbnail_url TEXT,

  -- Basic File Metadata (from browser, not extraction)
  file_type VARCHAR(20) NOT NULL, -- 'image', 'video'
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration FLOAT, -- For videos (from browser File API if available)

  -- EDITOR SELECTION (MANUAL - USER SELECTS FROM DROPDOWN)
  editor_id UUID REFERENCES editors(id) ON DELETE SET NULL,
  editor_name VARCHAR(255) NOT NULL, -- Denormalized for fast queries

  -- Upload Info
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  upload_date TIMESTAMP DEFAULT NOW(),

  -- User-Defined Metadata
  tags TEXT[], -- ["summer", "sale", "vertical"]
  description TEXT,
  campaign_hint VARCHAR(255), -- Optional: "Summer Sale Campaign"

  -- Soft Delete
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_media_editor_name ON media_files(editor_name) WHERE is_deleted = FALSE;
CREATE INDEX idx_media_editor_id ON media_files(editor_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_media_upload_date ON media_files(upload_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_media_file_type ON media_files(file_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_media_uploaded_by ON media_files(uploaded_by) WHERE is_deleted = FALSE;
CREATE INDEX idx_media_tags ON media_files USING GIN(tags);
CREATE INDEX idx_media_not_deleted ON media_files(is_deleted) WHERE is_deleted = FALSE;

-- Recreate upload_tracking table (depends on media_files)
DROP TABLE IF EXISTS upload_tracking CASCADE;

CREATE TABLE upload_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  file_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
  upload_month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, file_id)
);

CREATE INDEX idx_upload_tracking_month ON upload_tracking(user_id, upload_month);

-- Recreate access_logs table (depends on media_files)
DROP TABLE IF EXISTS access_logs CASCADE;

CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  file_id UUID REFERENCES media_files(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- 'view', 'download', 'delete', 'upload'
  ip_address INET,
  user_agent TEXT,
  additional_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_access_logs_user ON access_logs(user_id, created_at DESC);
CREATE INDEX idx_access_logs_file ON access_logs(file_id, created_at DESC);
CREATE INDEX idx_access_logs_action ON access_logs(action, created_at DESC);

-- Recreate editor_performance_summary view (depends on media_files)
DROP VIEW IF EXISTS editor_performance_summary CASCADE;

CREATE VIEW editor_performance_summary AS
SELECT
  e.id AS editor_id,
  e.name AS editor_name,
  e.display_name,
  COUNT(DISTINCT fa.fb_ad_id) AS total_ads,
  COALESCE(SUM(fa.spend), 0) AS total_spend,
  COALESCE(AVG(fa.cpm), 0) AS avg_cpm,
  COALESCE(AVG(fa.cpc), 0) AS avg_cpc,
  COALESCE(AVG(fa.cost_per_result), 0) AS avg_cost_per_result,
  COALESCE(SUM(fa.impressions), 0) AS total_impressions,
  COALESCE(SUM(fa.clicks), 0) AS total_clicks,
  COUNT(DISTINCT mf.id) AS total_files_uploaded
FROM editors e
LEFT JOIN facebook_ads fa ON fa.editor_id = e.id
LEFT JOIN media_files mf ON mf.editor_id = e.id AND mf.is_deleted = FALSE
WHERE e.is_active = TRUE
GROUP BY e.id, e.name, e.display_name;

-- Add comment
COMMENT ON TABLE media_files IS 'Uploaded media files stored in S3 with CloudFront URLs';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ media_files table successfully migrated to production schema';
  RAISE NOTICE '✅ All indexes and dependent tables recreated';
  RAISE NOTICE '✅ Ready for file uploads';
END $$;
