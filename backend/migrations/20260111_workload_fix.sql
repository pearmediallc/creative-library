-- Quick fix migration to complete workload setup
-- Run this instead of the full migration since some objects already exist

BEGIN;

-- Step 1: Ensure all columns exist (safe, will skip if exists)
ALTER TABLE file_requests
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS complexity VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(10,2);

-- Step 2: Create remaining tables (safe, will skip if exists)
CREATE TABLE IF NOT EXISTS file_request_time_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  editor_id UUID REFERENCES editors(id) ON DELETE SET NULL,
  estimated_hours DECIMAL(10,2),
  actual_hours DECIMAL(10,2),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id)
);

CREATE TABLE IF NOT EXISTS editor_workload_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_id UUID NOT NULL REFERENCES editors(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  active_requests INTEGER DEFAULT 0,
  completed_requests INTEGER DEFAULT 0,
  load_percentage DECIMAL(5,2) DEFAULT 0,
  avg_completion_time_hours DECIMAL(10,2),
  on_time_completion_rate DECIMAL(5,2),
  quality_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(editor_id, stat_date)
);

CREATE TABLE IF NOT EXISTS workload_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_id UUID REFERENCES editors(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  message TEXT NOT NULL,
  metadata JSONB,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Create indexes with IF NOT EXISTS (works in PostgreSQL 9.5+)
CREATE INDEX IF NOT EXISTS idx_time_tracking_request ON file_request_time_tracking(request_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_editor ON file_request_time_tracking(editor_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_status ON file_request_time_tracking(status);

CREATE INDEX IF NOT EXISTS idx_workload_stats_editor ON editor_workload_stats(editor_id);
CREATE INDEX IF NOT EXISTS idx_workload_stats_date ON editor_workload_stats(stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_workload_stats_load ON editor_workload_stats(load_percentage);

CREATE INDEX IF NOT EXISTS idx_workload_alerts_editor ON workload_alerts(editor_id);
CREATE INDEX IF NOT EXISTS idx_workload_alerts_type ON workload_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_workload_alerts_unresolved ON workload_alerts(is_resolved) WHERE is_resolved = FALSE;

-- Step 4: Create functions
CREATE OR REPLACE FUNCTION calculate_editor_load(editor_uuid UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  active_count INTEGER;
  max_capacity INTEGER;
  load_pct DECIMAL(5,2);
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM file_request_editors fre
  JOIN file_requests fr ON fre.request_id = fr.id
  WHERE fre.editor_id = editor_uuid
    AND fre.status IN ('pending', 'assigned', 'in_progress')
    AND fr.is_active = TRUE
    AND fr.completed_at IS NULL;

  SELECT COALESCE(max_concurrent_requests, 10) INTO max_capacity
  FROM editor_capacity
  WHERE editor_id = editor_uuid;

  IF max_capacity = 0 THEN
    RETURN 100;
  END IF;

  load_pct := (active_count::DECIMAL / max_capacity) * 100;
  RETURN LEAST(load_pct, 100);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_editor_capacity_status()
RETURNS TRIGGER AS $$
DECLARE
  target_editor_id UUID;
  new_load DECIMAL(5,2);
  new_status VARCHAR(20);
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_editor_id := OLD.editor_id;
  ELSE
    target_editor_id := NEW.editor_id;
  END IF;

  new_load := calculate_editor_load(target_editor_id);

  IF new_load >= 90 THEN
    new_status := 'overloaded';
  ELSIF new_load >= 70 THEN
    new_status := 'busy';
  ELSE
    new_status := 'available';
  END IF;

  UPDATE editor_capacity
  SET
    current_load_percentage = new_load,
    status = new_status,
    last_updated = CURRENT_TIMESTAMP
  WHERE editor_id = target_editor_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger
DROP TRIGGER IF EXISTS trigger_update_editor_capacity ON file_request_editors;
CREATE TRIGGER trigger_update_editor_capacity
AFTER INSERT OR UPDATE OR DELETE ON file_request_editors
FOR EACH ROW
EXECUTE FUNCTION update_editor_capacity_status();

-- Step 6: Create view
CREATE OR REPLACE VIEW editor_workload_summary AS
SELECT
  e.id AS editor_id,
  e.name AS editor_name,
  e.display_name,
  ec.current_load_percentage AS load_percentage,
  ec.status,
  ec.max_concurrent_requests,
  ec.avg_completion_time_hours,
  ec.is_available,
  COUNT(DISTINCT CASE WHEN fre.status IN ('pending', 'assigned', 'in_progress') AND fr.is_active = TRUE AND fr.completed_at IS NULL THEN fre.request_id END) AS active_requests,
  COUNT(DISTINCT CASE WHEN fre.status = 'completed' OR fr.completed_at IS NOT NULL THEN fre.request_id END) AS completed_requests,
  COUNT(DISTINCT fre.request_id) AS total_requests
FROM editors e
LEFT JOIN editor_capacity ec ON e.id = ec.editor_id
LEFT JOIN file_request_editors fre ON e.id = fre.editor_id
LEFT JOIN file_requests fr ON fre.request_id = fr.id
WHERE e.is_active = TRUE
GROUP BY e.id, e.name, e.display_name, ec.current_load_percentage, ec.status,
         ec.max_concurrent_requests, ec.avg_completion_time_hours, ec.is_available;

-- Step 7: Initialize capacity for new editors (safe)
INSERT INTO editor_capacity (editor_id, max_concurrent_requests, max_hours_per_week)
SELECT id, 10, 40.00
FROM editors
WHERE is_active = TRUE
  AND id NOT IN (SELECT editor_id FROM editor_capacity)
ON CONFLICT (editor_id) DO NOTHING;

-- Step 8: Update all editor loads
DO $$
DECLARE
  editor_record RECORD;
BEGIN
  FOR editor_record IN SELECT id FROM editors WHERE is_active = TRUE LOOP
    PERFORM calculate_editor_load(editor_record.id);
    UPDATE editor_capacity
    SET
      current_load_percentage = calculate_editor_load(editor_record.id),
      last_updated = CURRENT_TIMESTAMP
    WHERE editor_id = editor_record.id;
  END LOOP;
END $$;

COMMIT;

SELECT 'Workload management fix completed successfully!' AS status;
