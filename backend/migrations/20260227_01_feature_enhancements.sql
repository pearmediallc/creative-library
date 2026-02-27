-- Migration: Feature Enhancements
-- Date: 2026-02-27
-- Description: Adds columns and tables for new features including starred media, analytics, edit history, and permissions

-- 1. Add starred/high-performer feature to media_files
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS starred_at TIMESTAMP;
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS starred_by UUID REFERENCES users(id);

-- 2. Add analytics metrics for creative performance
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS analytics_metrics JSONB DEFAULT '{
  "creative_performance": {
    "hook_rate": null,
    "hold_rate": null,
    "avg_video_duration": null,
    "ctr": null,
    "ff_retention": null,
    "video_plays_25": null,
    "video_plays_50": null,
    "video_plays_75": null,
    "video_plays_100": null
  },
  "profitability": {
    "spend": null,
    "profit": null,
    "revenue": null,
    "roi": null
  }
}'::jsonb;

-- 3. Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_media_files_analytics ON media_files USING GIN (analytics_metrics);
CREATE INDEX IF NOT EXISTS idx_media_files_starred ON media_files(is_starred) WHERE is_starred = TRUE;

-- 4. Add reassignment notes per editor
ALTER TABLE file_request_editors ADD COLUMN IF NOT EXISTS reassignment_notes TEXT;
ALTER TABLE file_request_editors ADD COLUMN IF NOT EXISTS last_reassigned_at TIMESTAMP;
ALTER TABLE file_request_editors ADD COLUMN IF NOT EXISTS last_reassigned_by UUID REFERENCES users(id);

-- 5. Add view_all_requests permission to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS view_all_requests BOOLEAN DEFAULT FALSE;

-- 6. Add scheduled close for launch requests
ALTER TABLE launch_requests ADD COLUMN IF NOT EXISTS scheduled_close_at TIMESTAMP;
ALTER TABLE launch_requests ADD COLUMN IF NOT EXISTS auto_close_enabled BOOLEAN DEFAULT FALSE;

-- 7. Create file_request_edit_history table
CREATE TABLE IF NOT EXISTS file_request_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES users(id),
  edited_by_name VARCHAR(255),
  edited_at TIMESTAMP DEFAULT NOW(),
  changes JSONB NOT NULL,
  previous_values JSONB NOT NULL,
  edit_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_request_edit_history_request ON file_request_edit_history(file_request_id);
CREATE INDEX IF NOT EXISTS idx_file_request_edit_history_date ON file_request_edit_history(edited_at DESC);

-- 8. Create launch_request_edit_history table
CREATE TABLE IF NOT EXISTS launch_request_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_request_id UUID NOT NULL REFERENCES launch_requests(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES users(id),
  edited_by_name VARCHAR(255),
  edited_at TIMESTAMP DEFAULT NOW(),
  changes JSONB NOT NULL,
  previous_values JSONB NOT NULL,
  edit_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_launch_request_edit_history_request ON launch_request_edit_history(launch_request_id);
CREATE INDEX IF NOT EXISTS idx_launch_request_edit_history_date ON launch_request_edit_history(edited_at DESC);

-- 9. Grant view_all_requests to Ritu and Parmeet
UPDATE users SET view_all_requests = TRUE WHERE email IN ('ritu.singh@pearmediallc.com', 'parmeet.singh@pearmediallc.com');

-- 10. Add indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_media_files_filename_search ON media_files USING gin(to_tsvector('english', original_filename));
CREATE INDEX IF NOT EXISTS idx_media_files_tags_search ON media_files USING GIN(tags);

-- Verification query
SELECT
  'Migration completed successfully' as status,
  COUNT(*) FILTER (WHERE view_all_requests = TRUE) as users_with_view_all,
  (SELECT COUNT(*) FROM file_request_edit_history) as file_request_edit_records,
  (SELECT COUNT(*) FROM launch_request_edit_history) as launch_request_edit_records,
  (SELECT COUNT(*) FROM media_files WHERE is_starred = TRUE) as starred_media_count
FROM users;
