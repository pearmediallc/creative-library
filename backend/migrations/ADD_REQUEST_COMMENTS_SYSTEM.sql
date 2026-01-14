-- =====================================================
-- Phase 5: Add Request Comments System
-- Purpose: Allow Editors to leave feedback on file requests
-- =====================================================

-- Create file_request_comments table
CREATE TABLE IF NOT EXISTS file_request_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_request_comments_request ON file_request_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_request_comments_user ON file_request_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_request_comments_created ON file_request_comments(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_request_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_request_comment_timestamp
BEFORE UPDATE ON file_request_comments
FOR EACH ROW
EXECUTE FUNCTION update_request_comment_timestamp();

-- Verify table was created
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'file_request_comments'
ORDER BY ordinal_position;

-- Show success message
SELECT 'Request Comments System migration completed successfully!' AS status;
