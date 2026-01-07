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

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_favorite ON saved_searches(is_favorite) WHERE is_favorite = TRUE;

-- Filters JSONB structure:
-- {
--   "media_types": ["image", "video"],
--   "editor_ids": ["uuid1", "uuid2"],
--   "buyer_ids": ["uuid3"],
--   "folder_ids": ["uuid4"],
--   "tags": ["tag1", "tag2"],
--   "date_from": "2024-01-01",
--   "date_to": "2024-12-31",
--   "file_size_min": 1000000,
--   "file_size_max": 10000000,
--   "width_min": 1920,
--   "width_max": 3840,
--   "height_min": 1080,
--   "height_max": 2160,
--   "is_starred": true,
--   "search_term": "keyword"
-- }
