-- Update default editor capacity from 10 to 25 (creatives-based workload)
-- This updates all editors that still have the old default of 10

UPDATE editor_capacity
SET max_concurrent_requests = 25
WHERE max_concurrent_requests = 10;

-- Also update the default in the table definition
ALTER TABLE editor_capacity
  ALTER COLUMN max_concurrent_requests SET DEFAULT 25;

-- Update the calculate_editor_load function to use 25 as default
CREATE OR REPLACE FUNCTION calculate_editor_load(editor_uuid UUID)
RETURNS DECIMAL AS $$
DECLARE
  active_count INTEGER;
  max_concurrent INTEGER;
  load_pct DECIMAL;
BEGIN
  -- Count active assigned creatives (not requests)
  SELECT COALESCE(SUM(
    COALESCE(NULLIF(fre.num_creatives_assigned, 0), fr.num_creatives, 0)
  ), 0)
  INTO active_count
  FROM file_request_editors fre
  JOIN file_requests fr ON fr.id = fre.request_id
  WHERE fre.editor_id = editor_uuid
    AND fre.status IN ('pending', 'assigned', 'in_progress')
    AND fr.is_active = TRUE;

  -- Get max capacity (default 25)
  SELECT max_concurrent_requests INTO max_concurrent
  FROM editor_capacity
  WHERE editor_id = editor_uuid;

  IF max_concurrent IS NULL THEN
    max_concurrent := 25;
  END IF;

  IF max_concurrent > 0 THEN
    load_pct := (active_count::DECIMAL / max_concurrent::DECIMAL) * 100;
  ELSE
    load_pct := 0;
  END IF;

  RETURN load_pct;
END;
$$ LANGUAGE plpgsql;
