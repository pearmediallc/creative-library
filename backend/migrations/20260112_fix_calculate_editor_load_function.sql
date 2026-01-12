-- Hotfix: Fix calculate_editor_load function - remove fr.status reference
-- Date: 2026-01-12
-- Issue: Function references fr.status column which doesn't exist
-- Solution: Use fre.status and check fr.is_active and fr.completed_at instead

BEGIN;

CREATE OR REPLACE FUNCTION calculate_editor_load(editor_uuid UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  active_count INTEGER;
  max_concurrent INTEGER;
  load_pct DECIMAL(5,2);
BEGIN
  -- Get active request count
  -- Status is in file_request_editors table (fre.status), not file_requests
  SELECT COUNT(*) INTO active_count
  FROM file_request_editors fre
  JOIN file_requests fr ON fre.request_id = fr.id
  WHERE fre.editor_id = editor_uuid
    AND fre.status IN ('pending', 'assigned', 'in_progress')
    AND fr.is_active = TRUE
    AND fr.completed_at IS NULL;

  -- Get max concurrent from capacity
  SELECT COALESCE(max_concurrent_requests, 10) INTO max_concurrent
  FROM editor_capacity
  WHERE editor_id = editor_uuid;

  -- Calculate load percentage
  IF max_concurrent > 0 THEN
    load_pct := (active_count::DECIMAL / max_concurrent::DECIMAL) * 100;
  ELSE
    load_pct := 0;
  END IF;

  RETURN LEAST(load_pct, 100);
END;
$$ LANGUAGE plpgsql;

COMMIT;

SELECT 'Function calculate_editor_load fixed successfully!' AS status;
