-- ===================================================================
-- FIX REQUEST TEMPLATES TABLE SCHEMA
-- Date: 2026-01-16
-- Purpose: Add missing columns to request_templates table
-- ===================================================================

BEGIN;

-- Drop template_data column if it exists and add individual columns
ALTER TABLE request_templates DROP COLUMN IF EXISTS template_data;

-- Add all required columns if they don't exist
ALTER TABLE request_templates
ADD COLUMN IF NOT EXISTS default_title VARCHAR(500),
ADD COLUMN IF NOT EXISTS default_instructions TEXT,
ADD COLUMN IF NOT EXISTS default_priority VARCHAR(50) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS default_due_days INTEGER,
ADD COLUMN IF NOT EXISTS required_fields JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

COMMIT;

-- Verify migration
SELECT
  'request_templates' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'request_templates'
  AND column_name IN ('default_title', 'default_instructions', 'default_priority', 'default_due_days', 'required_fields', 'usage_count')
ORDER BY column_name;
