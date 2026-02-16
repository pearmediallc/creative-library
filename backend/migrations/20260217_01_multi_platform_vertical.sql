-- Migration: Support Multiple Platforms and Verticals per File Request
-- Created: 2026-02-17
-- Description: Create junction tables to support many-to-many relationships
--              between file requests and platforms/verticals

-- ============================================================================
-- PLATFORMS JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_request_platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  platform VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_request_platform UNIQUE(file_request_id, platform)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_file_request_platforms_request_id
  ON file_request_platforms(file_request_id);

CREATE INDEX IF NOT EXISTS idx_file_request_platforms_platform
  ON file_request_platforms(platform);

-- ============================================================================
-- VERTICALS JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_request_verticals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  vertical VARCHAR(100) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE, -- Used for auto-assignment
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_request_vertical UNIQUE(file_request_id, vertical)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_file_request_verticals_request_id
  ON file_request_verticals(file_request_id);

CREATE INDEX IF NOT EXISTS idx_file_request_verticals_vertical
  ON file_request_verticals(vertical);

CREATE INDEX IF NOT EXISTS idx_file_request_verticals_is_primary
  ON file_request_verticals(file_request_id, is_primary) WHERE is_primary = TRUE;

-- ============================================================================
-- DATA MIGRATION: Move existing platform/vertical data to junction tables
-- ============================================================================

-- Migrate existing platforms
INSERT INTO file_request_platforms (file_request_id, platform, created_at)
SELECT id, platform, created_at
FROM file_requests
WHERE platform IS NOT NULL AND platform != ''
ON CONFLICT (file_request_id, platform) DO NOTHING;

-- Migrate existing verticals (mark first as primary)
INSERT INTO file_request_verticals (file_request_id, vertical, is_primary, created_at)
SELECT id, vertical, TRUE, created_at
FROM file_requests
WHERE vertical IS NOT NULL AND vertical != ''
ON CONFLICT (file_request_id, vertical) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get platforms as array
CREATE OR REPLACE FUNCTION get_request_platforms(request_id UUID)
RETURNS TEXT[] AS $$
  SELECT ARRAY_AGG(platform ORDER BY created_at)
  FROM file_request_platforms
  WHERE file_request_id = request_id;
$$ LANGUAGE SQL STABLE;

-- Function to get verticals as array
CREATE OR REPLACE FUNCTION get_request_verticals(request_id UUID)
RETURNS TEXT[] AS $$
  SELECT ARRAY_AGG(vertical ORDER BY
    CASE WHEN is_primary THEN 0 ELSE 1 END,
    created_at
  )
  FROM file_request_verticals
  WHERE file_request_id = request_id;
$$ LANGUAGE SQL STABLE;

-- Function to get primary vertical
CREATE OR REPLACE FUNCTION get_primary_vertical(request_id UUID)
RETURNS TEXT AS $$
  SELECT vertical
  FROM file_request_verticals
  WHERE file_request_id = request_id AND is_primary = TRUE
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- VIEWS FOR BACKWARD COMPATIBILITY
-- ============================================================================

-- Updated view that includes platform and vertical arrays
CREATE OR REPLACE VIEW file_requests_enhanced AS
SELECT
  fr.*,
  get_request_platforms(fr.id) as platforms,
  get_request_verticals(fr.id) as verticals,
  get_primary_vertical(fr.id) as primary_vertical
FROM file_requests fr;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE file_request_platforms IS 'Junction table for many-to-many relationship between file requests and platforms';
COMMENT ON TABLE file_request_verticals IS 'Junction table for many-to-many relationship between file requests and verticals';
COMMENT ON COLUMN file_request_verticals.is_primary IS 'Primary vertical used for auto-assignment to vertical heads';
COMMENT ON FUNCTION get_request_platforms IS 'Returns array of platforms for a given file request';
COMMENT ON FUNCTION get_request_verticals IS 'Returns array of verticals for a given file request (primary first)';
COMMENT ON FUNCTION get_primary_vertical IS 'Returns the primary vertical for auto-assignment purposes';
