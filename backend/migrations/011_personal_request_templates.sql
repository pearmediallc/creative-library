-- Migration: Allow personal request templates (team_id nullable)
-- Date: 2026-02-13

ALTER TABLE request_templates
  ALTER COLUMN team_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_request_templates_team_null ON request_templates(team_id) WHERE team_id IS NULL;
