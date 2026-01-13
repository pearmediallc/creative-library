-- Migration: Add Canvas/Product Brief feature for File Requests
-- Date: 2026-01-13
-- Description: Adds file_request_canvas table for rich text briefs with attachments

-- Create canvas table
CREATE TABLE IF NOT EXISTS file_request_canvas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '{"blocks": []}',
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(file_request_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_canvas_request ON file_request_canvas(file_request_id);
CREATE INDEX IF NOT EXISTS idx_canvas_content ON file_request_canvas USING GIN(content);
CREATE INDEX IF NOT EXISTS idx_canvas_attachments ON file_request_canvas USING GIN(attachments);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_canvas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_canvas_timestamp
BEFORE UPDATE ON file_request_canvas
FOR EACH ROW
EXECUTE FUNCTION update_canvas_updated_at();

-- Rollback script (if needed):
-- DROP TRIGGER IF EXISTS trigger_update_canvas_timestamp ON file_request_canvas;
-- DROP FUNCTION IF EXISTS update_canvas_updated_at();
-- DROP TABLE IF EXISTS file_request_canvas;
