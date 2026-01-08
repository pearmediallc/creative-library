-- Create metadata_tags table for tag management
CREATE TABLE IF NOT EXISTS metadata_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create junction table for file-tag associations
CREATE TABLE IF NOT EXISTS media_file_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_file_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES metadata_tags(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(media_file_id, tag_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_metadata_tags_name ON metadata_tags(name);
CREATE INDEX IF NOT EXISTS idx_metadata_tags_category ON metadata_tags(category);
CREATE INDEX IF NOT EXISTS idx_metadata_tags_created_by ON metadata_tags(created_by);
CREATE INDEX IF NOT EXISTS idx_media_file_tags_file ON media_file_tags(media_file_id);
CREATE INDEX IF NOT EXISTS idx_media_file_tags_tag ON media_file_tags(tag_id);

-- Add usage count view (computed from actual tag usage)
CREATE OR REPLACE VIEW metadata_tags_with_usage AS
SELECT
  mt.*,
  COUNT(mft.id) as usage_count
FROM metadata_tags mt
LEFT JOIN media_file_tags mft ON mt.id = mft.tag_id
GROUP BY mt.id;

COMMENT ON TABLE metadata_tags IS 'Reusable metadata tags for organizing media files';
COMMENT ON TABLE media_file_tags IS 'Junction table linking media files to metadata tags';
COMMENT ON VIEW metadata_tags_with_usage IS 'Tags with computed usage counts';
