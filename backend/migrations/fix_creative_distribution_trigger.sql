-- Fix: Creative distribution trigger should exclude reassigned/completed editors
-- Previously it counted ALL editors' num_creatives_assigned, including those with
-- status='reassigned', causing "Total assigned exceeds requested" errors on reassignment.

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

  -- Get sum of creatives assigned to ACTIVE editors only
  -- Exclude reassigned/declined/cancelled editors from the count
  SELECT COALESCE(SUM(num_creatives_assigned), 0) INTO total_assigned
  FROM file_request_editors
  WHERE request_id = request_id_val
    AND status NOT IN ('reassigned', 'declined', 'cancelled');

  -- If this is an INSERT or UPDATE, include the new value
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Only add the new value if the new status is active (not reassigned/declined/cancelled)
    IF NEW.status NOT IN ('reassigned', 'declined', 'cancelled') THEN
      total_assigned := total_assigned + NEW.num_creatives_assigned;
    END IF;

    -- Subtract old value if updating (only if old status was active)
    IF TG_OP = 'UPDATE' THEN
      IF OLD.status NOT IN ('reassigned', 'declined', 'cancelled') THEN
        total_assigned := total_assigned - OLD.num_creatives_assigned;
      END IF;
    END IF;
  END IF;

  -- Allow assignment up to the requested amount
  IF total_assigned > total_requested AND total_requested > 0 THEN
    RAISE EXCEPTION 'Creative distribution error: Total assigned (%) exceeds requested (%) for request %',
      total_assigned, total_requested, request_id_val;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also fix the helper functions to only count active editors
CREATE OR REPLACE FUNCTION get_total_creatives_assigned(request_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(num_creatives_assigned), 0)::INTEGER
  FROM file_request_editors
  WHERE file_request_editors.request_id = $1
    AND status NOT IN ('reassigned', 'declined', 'cancelled');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_remaining_creatives(request_id UUID)
RETURNS INTEGER AS $$
  SELECT GREATEST(
    COALESCE(fr.num_creatives, 0) - COALESCE(SUM(fre.num_creatives_assigned), 0),
    0
  )::INTEGER
  FROM file_requests fr
  LEFT JOIN file_request_editors fre ON fre.request_id = fr.id
    AND fre.status NOT IN ('reassigned', 'declined', 'cancelled')
  WHERE fr.id = $1
  GROUP BY fr.id, fr.num_creatives;
$$ LANGUAGE SQL STABLE;
