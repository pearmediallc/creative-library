-- ===================================================================
-- TEAM MEMBERS PERMISSIONS MIGRATION
-- Date: 2026-01-15
-- Purpose: Add permission columns to team_members table
-- ===================================================================

BEGIN;

-- Add permission columns to team_members table
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_manage_members BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_create_folders BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_delete_files BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_manage_templates BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_view_analytics BOOLEAN DEFAULT FALSE;

-- Set default permissions based on existing team_role
UPDATE team_members
SET
  can_manage_members = CASE WHEN team_role IN ('admin', 'lead') THEN TRUE ELSE FALSE END,
  can_create_folders = CASE WHEN team_role IN ('admin', 'lead') THEN TRUE ELSE FALSE END,
  can_delete_files = CASE WHEN team_role IN ('admin', 'lead') THEN TRUE ELSE FALSE END,
  can_manage_templates = CASE WHEN team_role IN ('admin', 'lead') THEN TRUE ELSE FALSE END,
  can_view_analytics = CASE WHEN team_role IN ('admin', 'lead') THEN TRUE ELSE FALSE END
WHERE can_manage_members IS NULL;

COMMIT;

-- Verify migration
SELECT
  'team_members' as table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'team_members'
  AND column_name IN ('can_manage_members', 'can_create_folders', 'can_delete_files', 'can_manage_templates', 'can_view_analytics')
ORDER BY column_name;
