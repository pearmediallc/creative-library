-- Migration: Creative Distribution System
-- Created: 2026-02-17
-- Description: Enable vertical heads to distribute creatives among multiple editors
--              Track how many creatives each editor is assigned from a request

-- ============================================================================
-- ADD CREATIVE COUNT TO EDITOR ASSIGNMENTS
-- ============================================================================

-- Add column to track individual creative assignments
ALTER TABLE file_request_editors
ADD COLUMN IF NOT EXISTS num_creatives_assigned INTEGER DEFAULT 0;

-- Add column to track if editor completed their assigned creatives
ALTER TABLE file_request_editors
ADD COLUMN IF NOT EXISTS creatives_completed INTEGER DEFAULT 0;

-- Ensure non-negative values (use DO block to handle IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_creatives_assigned_non_negative'
  ) THEN
    ALTER TABLE file_request_editors
    ADD CONSTRAINT check_creatives_assigned_non_negative
    CHECK (num_creatives_assigned >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_creatives_completed_valid'
  ) THEN
    ALTER TABLE file_request_editors
    ADD CONSTRAINT check_creatives_completed_valid
    CHECK (creatives_completed >= 0 AND creatives_completed <= num_creatives_assigned);
  END IF;
END $$;

-- ============================================================================
-- MIGRATE EXISTING DATA
-- ============================================================================

-- For existing assignments without distribution, set to 0
-- (This allows gradual migration and backward compatibility)
UPDATE file_request_editors
SET num_creatives_assigned = 0
WHERE num_creatives_assigned IS NULL;

-- ============================================================================
-- VALIDATION FUNCTION: Ensure distribution doesn't exceed request total
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_creative_distribution()
RETURNS TRIGGER AS $$
DECLARE
  total_assigned INTEGER;
  total_requested INTEGER;
  request_id_val UUID;
BEGIN
  -- Get request_id from NEW or OLD record
  IF TG_OP = 'DELETE' THEN
    request_id_val := OLD.request_id;
  ELSE
    request_id_val := NEW.request_id;
  END IF;

  -- Get total creatives requested
  SELECT COALESCE(num_creatives, 0) INTO total_requested
  FROM file_requests WHERE id = request_id_val;

  -- Get sum of creatives assigned to all editors
  SELECT COALESCE(SUM(num_creatives_assigned), 0) INTO total_assigned
  FROM file_request_editors
  WHERE request_id = request_id_val;

  -- If this is an INSERT or UPDATE, include the new value
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    total_assigned := total_assigned + NEW.num_creatives_assigned;

    -- Subtract old value if updating
    IF TG_OP = 'UPDATE' THEN
      total_assigned := total_assigned - OLD.num_creatives_assigned;
    END IF;
  END IF;

  -- Allow assignment up to the requested amount
  -- (Can be less if splitting among editors or leaving some unassigned)
  IF total_assigned > total_requested AND total_requested > 0 THEN
    RAISE EXCEPTION 'Creative distribution error: Total assigned (%) exceeds requested (%) for request %',
      total_assigned, total_requested, request_id_val;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_validate_creative_distribution ON file_request_editors;
CREATE TRIGGER trigger_validate_creative_distribution
BEFORE INSERT OR UPDATE ON file_request_editors
FOR EACH ROW
EXECUTE FUNCTION validate_creative_distribution();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get total creatives assigned for a request
CREATE OR REPLACE FUNCTION get_total_creatives_assigned(request_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(num_creatives_assigned), 0)::INTEGER
  FROM file_request_editors
  WHERE file_request_editors.request_id = $1;
$$ LANGUAGE SQL STABLE;

-- Get remaining creatives for a request
CREATE OR REPLACE FUNCTION get_remaining_creatives(request_id UUID)
RETURNS INTEGER AS $$
  SELECT GREATEST(
    COALESCE(fr.num_creatives, 0) - COALESCE(SUM(fre.num_creatives_assigned), 0),
    0
  )::INTEGER
  FROM file_requests fr
  LEFT JOIN file_request_editors fre ON fre.request_id = fr.id
  WHERE fr.id = $1
  GROUP BY fr.id, fr.num_creatives;
$$ LANGUAGE SQL STABLE;

-- Get creative distribution summary for a request
CREATE OR REPLACE FUNCTION get_creative_distribution_summary(request_id UUID)
RETURNS TABLE (
  editor_id UUID,
  editor_name TEXT,
  num_assigned INTEGER,
  num_completed INTEGER,
  completion_percentage NUMERIC
) AS $$
  SELECT
    fre.editor_id,
    e.name as editor_name,
    fre.num_creatives_assigned as num_assigned,
    fre.creatives_completed as num_completed,
    CASE
      WHEN fre.num_creatives_assigned > 0
      THEN ROUND((fre.creatives_completed::NUMERIC / fre.num_creatives_assigned::NUMERIC) * 100, 2)
      ELSE 0
    END as completion_percentage
  FROM file_request_editors fre
  JOIN editors e ON e.id = fre.editor_id
  WHERE fre.request_id = $1
  ORDER BY fre.created_at;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- ENHANCED VIEW WITH DISTRIBUTION DATA
-- ============================================================================

CREATE OR REPLACE VIEW file_request_assignments_detailed AS
SELECT
  fre.id,
  fre.request_id,
  fre.editor_id,
  fre.status,
  fre.num_creatives_assigned,
  fre.creatives_completed,
  fre.created_at,
  e.name as editor_name,
  e.display_name as editor_display_name,
  fr.num_creatives as total_requested,
  CASE
    WHEN fre.num_creatives_assigned > 0
    THEN ROUND((fre.creatives_completed::NUMERIC / fre.num_creatives_assigned::NUMERIC) * 100, 2)
    ELSE 0
  END as completion_percentage
FROM file_request_editors fre
JOIN editors e ON e.id = fre.editor_id
JOIN file_requests fr ON fr.id = fre.request_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN file_request_editors.num_creatives_assigned IS 'Number of creatives assigned to this editor from the request';
COMMENT ON COLUMN file_request_editors.creatives_completed IS 'Number of creatives completed by this editor';
COMMENT ON FUNCTION validate_creative_distribution IS 'Ensures total assigned creatives do not exceed requested amount';
COMMENT ON FUNCTION get_total_creatives_assigned IS 'Returns total creatives assigned across all editors for a request';
COMMENT ON FUNCTION get_remaining_creatives IS 'Returns number of creatives not yet assigned to editors';
COMMENT ON FUNCTION get_creative_distribution_summary IS 'Returns detailed creative distribution and completion status per editor';
COMMENT ON VIEW file_request_assignments_detailed IS 'Enhanced view showing creative distribution details for each editor assignment';
