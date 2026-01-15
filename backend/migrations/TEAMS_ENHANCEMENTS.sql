-- ================================================
-- PHASE 8: TEAMS FEATURE ENHANCEMENTS MIGRATION
-- ================================================
-- This migration adds comprehensive team collaboration features:
-- 1. Team Folders (Shared Workspaces)
-- 2. Team Activity Feed
-- 3. Team Request Templates
-- 4. Team Analytics Dashboard
-- 5. Team Roles & Sub-permissions
-- ================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- FEATURE 1: TEAM FOLDERS (SHARED WORKSPACES)
-- ================================================

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team members with roles
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_role VARCHAR(50) NOT NULL DEFAULT 'member', -- lead, member, guest
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, user_id)
);

-- Modify folders table to support team ownership
ALTER TABLE folders
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(20) DEFAULT 'user'; -- 'user' or 'team'

-- Create indexes for team folders
CREATE INDEX IF NOT EXISTS idx_folders_team ON folders(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);

-- ================================================
-- FEATURE 2: TEAM ACTIVITY FEED
-- ================================================

CREATE TABLE IF NOT EXISTS team_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  activity_type VARCHAR(50) NOT NULL, -- folder_created, file_uploaded, request_created, etc.
  resource_type VARCHAR(50), -- folder, file, request
  resource_id UUID,
  metadata JSONB DEFAULT '{}', -- Additional activity details
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_activity_team ON team_activity(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_activity_user ON team_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_type ON team_activity(activity_type);

-- ================================================
-- FEATURE 3: TEAM REQUEST TEMPLATES
-- ================================================

CREATE TABLE IF NOT EXISTS request_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  default_title VARCHAR(255),
  default_instructions TEXT,
  default_priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
  default_due_days INTEGER, -- Days from creation
  required_fields JSONB DEFAULT '[]', -- Custom field definitions
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_request_templates_team ON request_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_request_templates_active ON request_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_request_templates_created_by ON request_templates(created_by);

-- ================================================
-- FEATURE 4: TEAM ANALYTICS DASHBOARD
-- ================================================

CREATE TABLE IF NOT EXISTS team_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_files INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  completed_requests INTEGER DEFAULT 0,
  avg_turnaround_hours NUMERIC(10, 2),
  total_uploads INTEGER DEFAULT 0,
  total_downloads INTEGER DEFAULT 0,
  active_members INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}', -- Additional metrics
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_team_date ON team_analytics_snapshots(team_id, snapshot_date DESC);

-- ================================================
-- FEATURE 5: TEAM ROLES & SUB-PERMISSIONS
-- ================================================

-- Extend team_members table with granular permissions
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS can_manage_members BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_create_folders BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_delete_files BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_templates BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_view_analytics BOOLEAN DEFAULT true;

-- Role presets table
CREATE TABLE IF NOT EXISTS team_role_presets (
  role_name VARCHAR(50) PRIMARY KEY,
  permissions JSONB NOT NULL,
  description TEXT
);

-- Insert default role presets
INSERT INTO team_role_presets (role_name, permissions, description) VALUES
('lead', '{"can_manage_members": true, "can_create_folders": true, "can_delete_files": true, "can_manage_templates": true, "can_view_analytics": true}', 'Full team management except deletion'),
('member', '{"can_manage_members": false, "can_create_folders": true, "can_delete_files": false, "can_manage_templates": false, "can_view_analytics": true}', 'Standard member access'),
('guest', '{"can_manage_members": false, "can_create_folders": false, "can_delete_files": false, "can_manage_templates": false, "can_view_analytics": false}', 'Read-only access')
ON CONFLICT (role_name) DO NOTHING;

-- ================================================
-- AUTO-UPDATE TRIGGERS
-- ================================================

-- Trigger to update teams.updated_at
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_teams_updated_at
BEFORE UPDATE ON teams
FOR EACH ROW
EXECUTE FUNCTION update_teams_updated_at();

-- Trigger to update request_templates.updated_at
CREATE OR REPLACE FUNCTION update_request_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_request_templates_updated_at
BEFORE UPDATE ON request_templates
FOR EACH ROW
EXECUTE FUNCTION update_request_templates_updated_at();

-- ================================================
-- MIGRATION COMPLETE
-- ================================================

-- Verification queries
DO $$
BEGIN
  RAISE NOTICE 'Teams Feature Enhancement Migration Complete!';
  RAISE NOTICE 'Created tables: teams, team_members, team_activity, request_templates, team_analytics_snapshots, team_role_presets';
  RAISE NOTICE 'Modified tables: folders (added team_id, ownership_type), team_members (added permission columns)';
END $$;
