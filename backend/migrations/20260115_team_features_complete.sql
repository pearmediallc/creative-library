-- ===================================================================
-- COMPLETE TEAM FEATURES MIGRATION
-- Date: 2026-01-15
-- Purpose: Add all missing team-related tables and features
-- ===================================================================

BEGIN;

-- ============================================================================
-- 1. TEAM MESSAGES TABLE (Discussion/Chat)
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  message_text TEXT NOT NULL,
  parent_message_id UUID REFERENCES team_messages(id) ON DELETE CASCADE,
  mentions UUID[],
  attachments JSONB DEFAULT '[]'::jsonb,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_messages_team_id ON team_messages(team_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_user_id ON team_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_parent ON team_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_created ON team_messages(created_at DESC);

-- ============================================================================
-- 2. TEAM MESSAGE READ RECEIPTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES team_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_message_reads_message ON team_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_team_message_reads_user ON team_message_reads(user_id);

-- ============================================================================
-- 3. REQUEST TEMPLATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS request_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_request_templates_team ON request_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_request_templates_created_by ON request_templates(created_by);

-- ============================================================================
-- 4. TEAM ACTIVITY LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  activity_type VARCHAR(100) NOT NULL,
  activity_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_activity_team ON team_activity(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_user ON team_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_created ON team_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_activity_type ON team_activity(activity_type);

-- ============================================================================
-- 5. SMART COLLECTIONS (Media Collections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS smart_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  collection_type VARCHAR(50) DEFAULT 'manual' CHECK (collection_type IN ('manual', 'smart')),
  smart_rules JSONB DEFAULT '[]'::jsonb,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_smart_collections_owner ON smart_collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_smart_collections_team ON smart_collections(team_id);
CREATE INDEX IF NOT EXISTS idx_smart_collections_type ON smart_collections(collection_type);

-- ============================================================================
-- 6. COLLECTION ITEMS (Files in collections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES smart_collections(id) ON DELETE CASCADE,
  file_request_upload_id UUID REFERENCES file_request_uploads(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES users(id),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(collection_id, file_request_upload_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_file ON collection_items(file_request_upload_id);

-- ============================================================================
-- 7. TEAM SHARED MEDIA (Share media with teams)
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_shared_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  file_request_upload_id UUID REFERENCES file_request_uploads(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES users(id),
  share_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, file_request_upload_id)
);

CREATE INDEX IF NOT EXISTS idx_team_shared_media_team ON team_shared_media(team_id);
CREATE INDEX IF NOT EXISTS idx_team_shared_media_file ON team_shared_media(file_request_upload_id);
CREATE INDEX IF NOT EXISTS idx_team_shared_media_shared_by ON team_shared_media(shared_by);

-- ============================================================================
-- 8. UPDATE NOTIFICATIONS TABLE (if it exists) for team messages
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    -- Add team_message_id column if it doesn't exist
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS team_message_id UUID REFERENCES team_messages(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_notifications_team_message ON notifications(team_message_id);
  END IF;
END $$;

COMMIT;

-- Verify migration
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM (
  VALUES
    ('team_messages'),
    ('team_message_reads'),
    ('request_templates'),
    ('team_activity'),
    ('smart_collections'),
    ('collection_items'),
    ('team_shared_media')
) AS t(table_name)
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables WHERE table_name = t.table_name
);
