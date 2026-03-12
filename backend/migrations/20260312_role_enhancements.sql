-- Add team_lead and assistant_team_lead role support
-- The users.role field already supports 'team_lead' as a value
-- This migration adds a table for vertical assignments per user (for team_leads, ATLs, vertical_heads)

CREATE TABLE IF NOT EXISTS user_vertical_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vertical VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, vertical)
);

CREATE INDEX IF NOT EXISTS idx_user_vertical_assignments_user ON user_vertical_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vertical_assignments_vertical ON user_vertical_assignments(vertical);

-- Backfill from existing vertical_heads table
INSERT INTO user_vertical_assignments (user_id, vertical)
SELECT head_editor_id, vertical FROM vertical_heads
WHERE head_editor_id IS NOT NULL
ON CONFLICT (user_id, vertical) DO NOTHING;
