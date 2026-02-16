-- Migration: Workload Update Triggers on File Uploads
-- Created: 2026-02-17
-- Description: Update editor workload automatically when files are uploaded
--              or when request status changes to reflect actual progress

-- ============================================================================
-- HELPER FUNCTION: Update Single Editor Capacity
-- ============================================================================

CREATE OR REPLACE FUNCTION update_editor_capacity_status_by_id(editor_uuid UUID)
RETURNS VOID AS $$
DECLARE
  load_pct DECIMAL(5,2);
  new_status VARCHAR(20);
BEGIN
  -- Calculate current load using existing function
  load_pct := calculate_editor_load(editor_uuid);

  -- Determine status based on load
  IF load_pct < 50 THEN
    new_status := 'available';
  ELSIF load_pct < 80 THEN
    new_status := 'busy';
  ELSIF load_pct < 100 THEN
    new_status := 'overloaded';
  ELSE
    new_status := 'at_capacity';
  END IF;

  -- Update editor capacity
  UPDATE editor_capacity
  SET
    current_load_percentage = load_pct,
    status = new_status,
    last_updated = CURRENT_TIMESTAMP
  WHERE editor_id = editor_uuid;

  -- If no capacity record exists, create one
  IF NOT FOUND THEN
    INSERT INTO editor_capacity (
      editor_id,
      current_load_percentage,
      status,
      max_concurrent_requests,
      max_hours_per_week,
      last_updated
    ) VALUES (
      editor_uuid,
      load_pct,
      new_status,
      10, -- default max concurrent
      40.00, -- default max hours per week
      CURRENT_TIMESTAMP
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER FUNCTION: Update Workload on File Upload
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_workload_on_upload()
RETURNS TRIGGER AS $$
DECLARE
  affected_editor_id UUID;
BEGIN
  -- Get editor_id from the upload record
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    affected_editor_id := NEW.editor_id;
  ELSIF TG_OP = 'DELETE' THEN
    affected_editor_id := OLD.editor_id;
  END IF;

  -- Update workload if editor_id exists
  IF affected_editor_id IS NOT NULL THEN
    PERFORM update_editor_capacity_status_by_id(affected_editor_id);
  END IF;

  -- Also update all editors assigned to this file request
  -- (Progress on uploads affects all assigned editors' perceived workload)
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM update_editor_capacity_status_by_id(fre.editor_id)
    FROM file_request_editors fre
    WHERE fre.request_id = NEW.file_request_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on file_request_uploads
DROP TRIGGER IF EXISTS trigger_workload_after_upload ON file_request_uploads;
CREATE TRIGGER trigger_workload_after_upload
AFTER INSERT OR UPDATE OR DELETE ON file_request_uploads
FOR EACH ROW
EXECUTE FUNCTION trigger_workload_on_upload();

-- ============================================================================
-- TRIGGER FUNCTION: Update Workload on Request Status Change
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_workload_on_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Update workload for all assigned editors
    PERFORM update_editor_capacity_status_by_id(fre.editor_id)
    FROM file_request_editors fre
    WHERE fre.request_id = NEW.id;

    -- Log the status change impact on workload
    INSERT INTO activity_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details,
      ip_address
    ) VALUES (
      COALESCE(NEW.updated_by, NEW.created_by),
      'status_change_workload_update',
      'file_request',
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'request_title', NEW.title
      ),
      '0.0.0.0' -- System triggered
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on file_requests status changes
DROP TRIGGER IF EXISTS trigger_workload_on_status_change ON file_requests;
CREATE TRIGGER trigger_workload_on_status_change
AFTER UPDATE OF status ON file_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION trigger_workload_on_request_status_change();

-- ============================================================================
-- TRIGGER FUNCTION: Update Workload on Assignment/Reassignment
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_workload_on_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update old editor's workload (on DELETE or UPDATE)
  IF TG_OP = 'DELETE' THEN
    PERFORM update_editor_capacity_status_by_id(OLD.editor_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.editor_id IS DISTINCT FROM NEW.editor_id THEN
    PERFORM update_editor_capacity_status_by_id(OLD.editor_id);
  END IF;

  -- Update new editor's workload (on INSERT or UPDATE)
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM update_editor_capacity_status_by_id(NEW.editor_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace existing trigger with enhanced version
DROP TRIGGER IF EXISTS trigger_update_editor_capacity ON file_request_editors;
CREATE TRIGGER trigger_update_editor_capacity
AFTER INSERT OR UPDATE OR DELETE ON file_request_editors
FOR EACH ROW
EXECUTE FUNCTION trigger_workload_on_assignment_change();

-- ============================================================================
-- ENHANCED WORKLOAD CALCULATION FUNCTION
-- ============================================================================

-- Override existing calculate_editor_load to consider upload progress
CREATE OR REPLACE FUNCTION calculate_editor_load(editor_uuid UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  active_count INTEGER;
  weighted_load DECIMAL(10,2);
  max_concurrent INTEGER;
  load_pct DECIMAL(5,2);
BEGIN
  -- Get max concurrent from capacity
  SELECT max_concurrent_requests INTO max_concurrent
  FROM editor_capacity
  WHERE editor_id = editor_uuid;

  IF max_concurrent IS NULL THEN
    max_concurrent := 10; -- default
  END IF;

  -- Calculate weighted load based on request status and progress
  -- Formula: Each request gets a weight based on its status
  -- - open/pending: 1.0 (full weight)
  -- - in_progress: 0.8 (80% weight - work started)
  -- - uploaded: 0.3 (30% weight - mostly done, pending review)
  -- - other statuses: 0 (not counting towards active load)
  SELECT
    SUM(
      CASE fr.status
        WHEN 'open' THEN 1.0
        WHEN 'in_progress' THEN 0.8
        WHEN 'uploaded' THEN 0.3
        ELSE 0
      END *
      -- Weight by creative distribution if specified
      CASE
        WHEN fre.num_creatives_assigned > 0 AND fr.num_creatives > 0
        THEN (fre.num_creatives_assigned::DECIMAL / fr.num_creatives::DECIMAL)
        ELSE 1.0
      END
    ) INTO weighted_load
  FROM file_request_editors fre
  JOIN file_requests fr ON fre.request_id = fr.id
  WHERE fre.editor_id = editor_uuid
    AND fr.status IN ('open', 'in_progress', 'uploaded', 'pending', 'assigned');

  -- Handle NULL case
  IF weighted_load IS NULL THEN
    weighted_load := 0;
  END IF;

  -- Calculate load percentage
  IF max_concurrent > 0 THEN
    load_pct := (weighted_load / max_concurrent::DECIMAL) * 100;
  ELSE
    load_pct := 0;
  END IF;

  RETURN ROUND(load_pct, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Recalculate All Editor Workloads (Admin Tool)
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_all_editor_workloads()
RETURNS TABLE (
  editor_id UUID,
  editor_name TEXT,
  old_load DECIMAL(5,2),
  new_load DECIMAL(5,2),
  status VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  WITH old_loads AS (
    SELECT
      e.id,
      e.name,
      ec.current_load_percentage as old_load
    FROM editors e
    LEFT JOIN editor_capacity ec ON e.id = ec.editor_id
    WHERE e.is_active = TRUE
  )
  SELECT
    ol.id,
    ol.name,
    ol.old_load,
    calculate_editor_load(ol.id) as new_load,
    CASE
      WHEN calculate_editor_load(ol.id) < 50 THEN 'available'::VARCHAR(20)
      WHEN calculate_editor_load(ol.id) < 80 THEN 'busy'::VARCHAR(20)
      WHEN calculate_editor_load(ol.id) < 100 THEN 'overloaded'::VARCHAR(20)
      ELSE 'at_capacity'::VARCHAR(20)
    END as status
  FROM old_loads ol;

  -- Update all capacity records
  PERFORM update_editor_capacity_status_by_id(e.id)
  FROM editors e
  WHERE e.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION trigger_workload_on_upload IS 'Automatically updates editor workload when files are uploaded to requests';
COMMENT ON FUNCTION trigger_workload_on_request_status_change IS 'Updates workload when request status changes (e.g., open → uploaded)';
COMMENT ON FUNCTION trigger_workload_on_assignment_change IS 'Updates workload when editors are assigned/reassigned to requests';
COMMENT ON FUNCTION calculate_editor_load IS 'Enhanced workload calculation considering request status, upload progress, and creative distribution';
COMMENT ON FUNCTION recalculate_all_editor_workloads IS 'Admin function to recalculate all editor workloads at once';
COMMENT ON FUNCTION update_editor_capacity_status_by_id IS 'Helper function to update a single editor''s capacity and status';
