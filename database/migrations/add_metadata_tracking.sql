-- ============================================
-- METADATA TRACKING MIGRATION
-- Add columns to track metadata operations
-- ============================================

-- Add metadata tracking columns to media_files table
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS metadata_stripped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS metadata_embedded JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS metadata_operations TEXT[] DEFAULT '{}';

-- Add comment to explain the columns
COMMENT ON COLUMN media_files.metadata_stripped IS 'Whether original metadata was removed during upload';
COMMENT ON COLUMN media_files.metadata_embedded IS 'JSON object containing embedded metadata details (creator_id, timestamp, etc.)';
COMMENT ON COLUMN media_files.metadata_operations IS 'Array of metadata operations performed (e.g., ["stripped_image", "embedded_creator_image"])';

-- Create index for metadata operations
CREATE INDEX IF NOT EXISTS idx_media_metadata_operations ON media_files USING GIN(metadata_operations);

-- Create index for metadata embedded (when not null)
CREATE INDEX IF NOT EXISTS idx_media_metadata_embedded ON media_files(metadata_embedded) WHERE metadata_embedded IS NOT NULL;

-- Add check to ensure at least one operation if metadata_operations is not empty
ALTER TABLE media_files
ADD CONSTRAINT check_metadata_operations_valid
CHECK (
  metadata_operations IS NULL OR
  array_length(metadata_operations, 1) IS NULL OR
  array_length(metadata_operations, 1) > 0
);

-- Update existing records to have empty array instead of null
UPDATE media_files
SET metadata_operations = '{}'
WHERE metadata_operations IS NULL;

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Metadata tracking columns added successfully';
  RAISE NOTICE 'Columns added: metadata_stripped, metadata_embedded, metadata_operations';
  RAISE NOTICE 'Indexes created for GIN search on metadata_operations and metadata_embedded';
END $$;
