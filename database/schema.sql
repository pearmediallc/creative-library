-- ============================================
-- CREATIVE ASSET LIBRARY - DATABASE SCHEMA
-- PostgreSQL 14+
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'creative', -- 'admin', 'creative', 'buyer'
  upload_limit_monthly INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- ============================================
-- EDITORS (Managed by Admins)
-- ============================================

CREATE TABLE editors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) UNIQUE NOT NULL, -- "DEEP", "DEEPA", "JOHN"
  display_name VARCHAR(255), -- Optional friendly name "Deep Kumar"
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_editors_name ON editors(name) WHERE is_active = TRUE;
CREATE INDEX idx_editors_active ON editors(is_active);

-- ============================================
-- MEDIA FILES (Core Library Storage)
-- ============================================

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

-- ============================================
-- UPLOAD TRACKING (Monthly Limits)
-- ============================================

CREATE TABLE upload_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  file_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
  upload_month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, file_id)
);

CREATE INDEX idx_upload_tracking_month ON upload_tracking(user_id, upload_month);

-- ============================================
-- ACCESS LOGS (Audit Trail)
-- ============================================

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

-- ============================================
-- FACEBOOK ANALYTICS (Cached Performance Data)
-- ============================================

CREATE TABLE facebook_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fb_campaign_id VARCHAR(255) UNIQUE NOT NULL,
  fb_ad_account_id VARCHAR(255) NOT NULL,
  campaign_name TEXT,
  status VARCHAR(50),
  objective VARCHAR(100),
  created_time TIMESTAMP,
  last_synced_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fb_campaigns_account ON facebook_campaigns(fb_ad_account_id);
CREATE INDEX idx_fb_campaigns_fb_id ON facebook_campaigns(fb_campaign_id);

CREATE TABLE facebook_ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fb_ad_id VARCHAR(255) UNIQUE NOT NULL,
  fb_campaign_id VARCHAR(255) REFERENCES facebook_campaigns(fb_campaign_id),
  fb_ad_account_id VARCHAR(255) NOT NULL,

  -- Ad Name (CRITICAL - Track Changes!)
  ad_name TEXT NOT NULL,
  ad_name_hash VARCHAR(64), -- SHA256 hash for fast change detection
  ad_name_last_checked TIMESTAMP DEFAULT NOW(),
  ad_name_change_count INTEGER DEFAULT 0,

  status VARCHAR(50),

  -- Editor Extraction (From Ad Name - REGEX PARSING)
  editor_name VARCHAR(255),
  editor_id UUID REFERENCES editors(id),
  extraction_method VARCHAR(50) DEFAULT 'ad_name_regex',
  extraction_confidence DECIMAL(3, 2), -- 0.00 to 1.00

  -- Performance Metrics
  spend DECIMAL(12, 2),
  impressions BIGINT,
  clicks BIGINT,
  cpm DECIMAL(10, 2),
  cpc DECIMAL(10, 2),
  ctr DECIMAL(10, 4),
  cost_per_result DECIMAL(10, 2),
  results INTEGER,

  -- Date Range
  insights_date_start DATE,
  insights_date_end DATE,

  -- Sync Info
  last_synced_at TIMESTAMP DEFAULT NOW(),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fb_ads_campaign ON facebook_ads(fb_campaign_id);
CREATE INDEX idx_fb_ads_editor_name ON facebook_ads(editor_name) WHERE editor_name IS NOT NULL;
CREATE INDEX idx_fb_ads_editor_id ON facebook_ads(editor_id) WHERE editor_id IS NOT NULL;
CREATE INDEX idx_fb_ads_date_range ON facebook_ads(insights_date_start, insights_date_end);
CREATE INDEX idx_fb_ads_account ON facebook_ads(fb_ad_account_id);
CREATE INDEX idx_fb_ads_hash ON facebook_ads(ad_name_hash);

-- Function to update ad name hash
CREATE OR REPLACE FUNCTION update_ad_name_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ad_name_hash = encode(digest(NEW.ad_name, 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update hash
CREATE TRIGGER trigger_update_ad_name_hash
BEFORE INSERT OR UPDATE OF ad_name ON facebook_ads
FOR EACH ROW
EXECUTE FUNCTION update_ad_name_hash();

-- ============================================
-- AD NAME CHANGE TRACKING (NEW!)
-- ============================================

CREATE TABLE ad_name_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Facebook Ad Info
  fb_ad_id VARCHAR(255) NOT NULL,
  fb_campaign_id VARCHAR(255),
  fb_ad_account_id VARCHAR(255) NOT NULL,

  -- Change Details
  old_ad_name TEXT NOT NULL,
  new_ad_name TEXT NOT NULL,
  changed_at TIMESTAMP NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW(),

  -- Editor Impact
  old_editor_name VARCHAR(255),
  new_editor_name VARCHAR(255),
  editor_changed BOOLEAN GENERATED ALWAYS AS (
    COALESCE(old_editor_name, '') != COALESCE(new_editor_name, '')
  ) STORED,

  -- Who Made the Change (if known)
  changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_via VARCHAR(50), -- 'facebook_ui', 'api', 'campaign_launcher', 'unknown'

  -- Additional Context
  change_source VARCHAR(50) DEFAULT 'api_detection',
  ip_address INET,
  user_agent TEXT,
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ad_name_changes_fb_ad ON ad_name_changes(fb_ad_id, changed_at DESC);
CREATE INDEX idx_ad_name_changes_editor ON ad_name_changes(editor_changed) WHERE editor_changed = TRUE;
CREATE INDEX idx_ad_name_changes_detected ON ad_name_changes(detected_at DESC);
CREATE INDEX idx_ad_name_changes_user ON ad_name_changes(changed_by_user_id) WHERE changed_by_user_id IS NOT NULL;
CREATE INDEX idx_ad_name_changes_account ON ad_name_changes(fb_ad_account_id, changed_at DESC);

-- ============================================
-- FACEBOOK AUTH (User-Specific OAuth Tokens)
-- ============================================

CREATE TABLE facebook_auth (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  -- Encrypted Tokens
  access_token_encrypted TEXT NOT NULL,

  -- Token Info
  expires_at TIMESTAMP NOT NULL,
  fb_user_id VARCHAR(255),
  fb_user_name VARCHAR(255),
  fb_user_email VARCHAR(255),

  -- Permissions
  granted_permissions TEXT[],

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fb_auth_user ON facebook_auth(user_id);
CREATE INDEX idx_fb_auth_fb_user ON facebook_auth(fb_user_id);

-- ============================================
-- ANALYTICS CACHE (Aggregated Performance)
-- ============================================

CREATE TABLE analytics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  editor_name VARCHAR(255),
  date_range_start DATE,
  date_range_end DATE,

  -- Aggregated Metrics
  data JSONB NOT NULL,

  computed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_cache_key ON analytics_cache(cache_key) WHERE expires_at > NOW();
CREATE INDEX idx_analytics_cache_editor ON analytics_cache(editor_name, date_range_start, date_range_end);
CREATE INDEX idx_analytics_cache_expires ON analytics_cache(expires_at);

-- ============================================
-- ADMIN AUDIT LOG (Track Admin Actions)
-- ============================================

CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- 'create_user', 'delete_user', 'create_editor', etc.
  target_type VARCHAR(50), -- 'user', 'editor', 'file'
  target_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_admin ON admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX idx_admin_audit_action ON admin_audit_log(action, created_at DESC);
CREATE INDEX idx_admin_audit_date ON admin_audit_log(created_at DESC);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View for Ad Name Change Alerts
CREATE VIEW ad_name_change_alerts AS
SELECT
  anc.id,
  anc.fb_ad_id,
  fa.ad_name AS current_ad_name,
  anc.old_ad_name,
  anc.new_ad_name,
  anc.old_editor_name,
  anc.new_editor_name,
  anc.changed_at,
  anc.detected_at,
  u.name AS changed_by_user_name,
  u.email AS changed_by_user_email,
  anc.changed_via,
  fc.campaign_name,
  anc.fb_ad_account_id
FROM ad_name_changes anc
LEFT JOIN facebook_ads fa ON fa.fb_ad_id = anc.fb_ad_id
LEFT JOIN users u ON u.id = anc.changed_by_user_id
LEFT JOIN facebook_campaigns fc ON fc.fb_campaign_id = anc.fb_campaign_id
WHERE anc.editor_changed = TRUE
ORDER BY anc.changed_at DESC;

-- View for Editor Performance Summary
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

-- ============================================
-- INITIAL DATA SEED
-- ============================================

COMMENT ON TABLE users IS 'System users with role-based access control';
COMMENT ON TABLE editors IS 'Creative team members (DEEP, DEEPA, etc.)';
COMMENT ON TABLE media_files IS 'Uploaded media files stored in S3';
COMMENT ON TABLE facebook_ads IS 'Cached Facebook ad data with performance metrics';
COMMENT ON TABLE ad_name_changes IS 'Log of all ad name changes detected from Facebook';
