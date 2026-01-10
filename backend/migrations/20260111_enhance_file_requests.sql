-- Migration: Enhance file requests system
-- Date: 2026-01-11
-- Description: Add request types, multi-editor support, folders, timers, and delivery notes

-- ============================================================================
-- 1. ADD NEW COLUMNS TO file_requests TABLE
-- ============================================================================

ALTER TABLE file_requests
  ADD COLUMN IF NOT EXISTS request_type VARCHAR(50) DEFAULT 'UGC + B-Roll',
  ADD COLUMN IF NOT EXISTS concept_notes TEXT,
  ADD COLUMN IF NOT EXISTS num_creatives INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS time_to_pick_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS time_to_complete_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_note TEXT;

-- Add index for request type filtering
CREATE INDEX IF NOT EXISTS idx_file_requests_type ON file_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_file_requests_completed ON file_requests(completed_at) WHERE completed_at IS NOT NULL;

-- Migrate existing description to concept_notes
UPDATE file_requests
SET concept_notes = description
WHERE concept_notes IS NULL AND description IS NOT NULL;

-- ============================================================================
-- 2. CREATE file_request_editors TABLE (Many-to-Many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_request_editors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL REFERENCES editors(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id), -- Optional: assigned user for the editor
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, in_progress, completed, declined
  accepted_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  time_to_accept_minutes INTEGER,
  time_to_complete_minutes INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id, editor_id)
);

CREATE INDEX idx_file_request_editors_request ON file_request_editors(request_id);
CREATE INDEX idx_file_request_editors_editor ON file_request_editors(editor_id);
CREATE INDEX idx_file_request_editors_status ON file_request_editors(status);
CREATE INDEX idx_file_request_editors_user ON file_request_editors(user_id) WHERE user_id IS NOT NULL;

-- Migrate existing single-editor assignments
INSERT INTO file_request_editors (request_id, editor_id, status, created_at)
SELECT id, editor_id, 'pending', created_at
FROM file_requests
WHERE editor_id IS NOT NULL
ON CONFLICT (request_id, editor_id) DO NOTHING;

-- ============================================================================
-- 3. CREATE file_request_folders TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_request_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  folder_name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_file_request_folders_request ON file_request_folders(request_id);
CREATE INDEX idx_file_request_folders_created_by ON file_request_folders(created_by);

-- ============================================================================
-- 4. UPDATE file_request_uploads TABLE
-- ============================================================================

ALTER TABLE file_request_uploads
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES file_request_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS editor_id UUID REFERENCES editors(id);

CREATE INDEX IF NOT EXISTS idx_file_request_uploads_folder ON file_request_uploads(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_editor ON file_request_uploads(editor_id) WHERE editor_id IS NOT NULL;

-- ============================================================================
-- 5. CREATE TRIGGER TO UPDATE updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_file_request_editors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_file_request_editors_updated_at
BEFORE UPDATE ON file_request_editors
FOR EACH ROW
EXECUTE FUNCTION update_file_request_editors_updated_at();

CREATE TRIGGER trigger_update_file_request_folders_updated_at
BEFORE UPDATE ON file_request_folders
FOR EACH ROW
EXECUTE FUNCTION update_file_request_editors_updated_at();

-- ============================================================================
-- 6. ADD CONSTRAINTS
-- ============================================================================

ALTER TABLE file_requests
  ADD CONSTRAINT check_num_creatives_positive CHECK (num_creatives > 0),
  ADD CONSTRAINT check_time_to_pick_non_negative CHECK (time_to_pick_minutes >= 0),
  ADD CONSTRAINT check_time_to_complete_non_negative CHECK (time_to_complete_minutes >= 0);

-- ============================================================================
-- ROLLBACK SCRIPT (for reference, do not execute)
-- ============================================================================
/*
DROP TRIGGER IF EXISTS trigger_update_file_request_editors_updated_at ON file_request_editors;
DROP TRIGGER IF EXISTS trigger_update_file_request_folders_updated_at ON file_request_folders;
DROP FUNCTION IF EXISTS update_file_request_editors_updated_at();

ALTER TABLE file_request_uploads
  DROP COLUMN IF EXISTS folder_id,
  DROP COLUMN IF EXISTS editor_id;

DROP TABLE IF EXISTS file_request_folders CASCADE;
DROP TABLE IF EXISTS file_request_editors CASCADE;

ALTER TABLE file_requests
  DROP CONSTRAINT IF EXISTS check_num_creatives_positive,
  DROP CONSTRAINT IF EXISTS check_time_to_pick_non_negative,
  DROP CONSTRAINT IF EXISTS check_time_to_complete_non_negative,
  DROP COLUMN IF EXISTS request_type,
  DROP COLUMN IF EXISTS concept_notes,
  DROP COLUMN IF EXISTS num_creatives,
  DROP COLUMN IF EXISTS assigned_at,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS time_to_pick_minutes,
  DROP COLUMN IF EXISTS time_to_complete_minutes,
  DROP COLUMN IF EXISTS delivery_note;
*/
