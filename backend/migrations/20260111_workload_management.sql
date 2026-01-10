-- ============================================
-- WORKLOAD MANAGEMENT SYSTEM MIGRATION
-- Adds tracking for editor capacity and workload
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Update file_requests table with time tracking
-- ============================================

ALTER TABLE file_requests
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS complexity VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(10,2);

COMMENT ON COLUMN file_requests.priority IS 'Priority level 1-5, where 1 is highest priority';
COMMENT ON COLUMN file_requests.complexity IS 'Complexity: low, medium, high, urgent';
COMMENT ON COLUMN file_requests.estimated_hours IS 'Estimated hours to complete';
COMMENT ON COLUMN file_requests.actual_hours IS 'Actual hours spent';

-- ============================================
-- STEP 2: Create editor_capacity table
-- ============================================

CREATE TABLE IF NOT EXISTS editor_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_id UUID NOT NULL REFERENCES editors(id) ON DELETE CASCADE,

  -- Capacity settings
  max_concurrent_requests INTEGER DEFAULT 10,
  max_hours_per_week DECIMAL(5,2) DEFAULT 40.00,

  -- Current status
  current_load_percentage DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'available', -- available, busy, overloaded, unavailable

  -- Performance metrics
  avg_completion_time_hours DECIMAL(10,2),
  total_completed_requests INTEGER DEFAULT 0,

  -- Availability
  is_available BOOLEAN DEFAULT TRUE,
  unavailable_until TIMESTAMP,
  unavailable_reason TEXT,

  -- Timestamps
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(editor_id)
);

CREATE INDEX idx_editor_capacity_editor ON editor_capacity(editor_id);
CREATE INDEX idx_editor_capacity_status ON editor_capacity(status);
CREATE INDEX idx_editor_capacity_available ON editor_capacity(is_available) WHERE is_available = TRUE;

COMMENT ON TABLE editor_capacity IS 'Track editor availability and capacity for workload management';

-- ============================================
-- STEP 3: Create file_request_time_tracking table
-- ============================================

CREATE TABLE IF NOT EXISTS file_request_time_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL REFERENCES editors(id) ON DELETE CASCADE,

  -- Time estimates
  estimated_hours DECIMAL(10,2),
  actual_hours DECIMAL(10,2),

  -- Dates
  started_at TIMESTAMP,
  estimated_completion TIMESTAMP,
  actual_completion TIMESTAMP,

  -- Classification
  complexity VARCHAR(20) DEFAULT 'medium',
  priority INTEGER DEFAULT 3,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(request_id)
);

CREATE INDEX idx_time_tracking_request ON file_request_time_tracking(request_id);
CREATE INDEX idx_time_tracking_editor ON file_request_time_tracking(editor_id);
CREATE INDEX idx_time_tracking_status ON file_request_time_tracking(status);

COMMENT ON TABLE file_request_time_tracking IS 'Track time estimates and actuals for file requests';

-- ============================================
-- STEP 4: Create editor_workload_stats table
-- ============================================

CREATE TABLE IF NOT EXISTS editor_workload_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_id UUID NOT NULL REFERENCES editors(id) ON DELETE CASCADE,
  stat_date DATE DEFAULT CURRENT_DATE,

  -- Request counts
  total_requests INTEGER DEFAULT 0,
  active_requests INTEGER DEFAULT 0,
  completed_requests INTEGER DEFAULT 0,
  pending_requests INTEGER DEFAULT 0,

  -- Time metrics
  avg_completion_time_hours DECIMAL(10,2),
  total_hours_worked DECIMAL(10,2),

  -- Load metrics
  load_percentage DECIMAL(5,2),
  capacity_utilized DECIMAL(5,2),

  -- Performance
  on_time_completion_rate DECIMAL(5,2),
  quality_score DECIMAL(3,2),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(editor_id, stat_date)
);

CREATE INDEX idx_workload_stats_editor ON editor_workload_stats(editor_id);
CREATE INDEX idx_workload_stats_date ON editor_workload_stats(stat_date DESC);
CREATE INDEX idx_workload_stats_load ON editor_workload_stats(load_percentage);

COMMENT ON TABLE editor_workload_stats IS 'Daily aggregated workload statistics per editor';

-- ============================================
-- STEP 5: Create workload_alerts table
-- ============================================

CREATE TABLE IF NOT EXISTS workload_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_id UUID NOT NULL REFERENCES editors(id) ON DELETE CASCADE,

  alert_type VARCHAR(50) NOT NULL, -- overload, deadline_approaching, capacity_low
  severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  message TEXT NOT NULL,

  -- Alert data
  metadata JSONB,

  -- Status
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),

  -- Notifications
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workload_alerts_editor ON workload_alerts(editor_id);
CREATE INDEX idx_workload_alerts_type ON workload_alerts(alert_type);
CREATE INDEX idx_workload_alerts_unresolved ON workload_alerts(is_resolved) WHERE is_resolved = FALSE;

COMMENT ON TABLE workload_alerts IS 'Alerts for workload management issues';

-- ============================================
-- STEP 6: Initialize editor capacity for existing editors
-- ============================================

INSERT INTO editor_capacity (editor_id, max_concurrent_requests, max_hours_per_week)
SELECT id, 10, 40.00
FROM editors
WHERE is_active = TRUE
ON CONFLICT (editor_id) DO NOTHING;

-- ============================================
-- STEP 7: Create function to calculate editor workload
-- ============================================

CREATE OR REPLACE FUNCTION calculate_editor_load(editor_uuid UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  active_count INTEGER;
  max_concurrent INTEGER;
  load_pct DECIMAL(5,2);
BEGIN
  -- Get active request count
  SELECT COUNT(*) INTO active_count
  FROM file_requests fr
  LEFT JOIN file_request_editors fre ON fr.id = fre.request_id
  WHERE fre.editor_id = editor_uuid
    AND fr.status IN ('pending', 'in_progress', 'assigned');

  -- Get max concurrent from capacity
  SELECT max_concurrent_requests INTO max_concurrent
  FROM editor_capacity
  WHERE editor_id = editor_uuid;

  -- Calculate load percentage
  IF max_concurrent > 0 THEN
    load_pct := (active_count::DECIMAL / max_concurrent::DECIMAL) * 100;
  ELSE
    load_pct := 0;
  END IF;

  RETURN ROUND(load_pct, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_editor_load IS 'Calculate current load percentage for an editor';

-- ============================================
-- STEP 8: Create function to update editor capacity status
-- ============================================

CREATE OR REPLACE FUNCTION update_editor_capacity_status()
RETURNS TRIGGER AS $$
DECLARE
  load_pct DECIMAL(5,2);
  new_status VARCHAR(20);
BEGIN
  -- Calculate current load
  load_pct := calculate_editor_load(NEW.editor_id);

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
  WHERE editor_id = NEW.editor_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 9: Create triggers for auto-updates
-- ============================================

-- Trigger on file_request_editors to update capacity when assignment changes
DROP TRIGGER IF EXISTS trigger_update_editor_capacity ON file_request_editors;
CREATE TRIGGER trigger_update_editor_capacity
AFTER INSERT OR UPDATE OR DELETE ON file_request_editors
FOR EACH ROW
EXECUTE FUNCTION update_editor_capacity_status();

-- ============================================
-- STEP 10: Create view for editor workload summary
-- ============================================

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

COMMENT ON VIEW editor_workload_summary IS 'Summary view of editor workload for dashboard';

-- ============================================
-- STEP 11: Verify migration
-- ============================================

DO $$
DECLARE
  missing TEXT := '';
BEGIN
  -- Check tables
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'editor_capacity') THEN
    missing := missing || 'editor_capacity, ';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'file_request_time_tracking') THEN
    missing := missing || 'file_request_time_tracking, ';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'editor_workload_stats') THEN
    missing := missing || 'editor_workload_stats, ';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workload_alerts') THEN
    missing := missing || 'workload_alerts, ';
  END IF;

  -- Check columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'file_requests' AND column_name = 'priority') THEN
    missing := missing || 'file_requests.priority, ';
  END IF;

  IF LENGTH(missing) > 0 THEN
    RAISE EXCEPTION 'Migration incomplete! Missing: %', missing;
  ELSE
    RAISE NOTICE '✅ Workload management migration completed successfully!';
    RAISE NOTICE '   - editor_capacity table created';
    RAISE NOTICE '   - file_request_time_tracking table created';
    RAISE NOTICE '   - editor_workload_stats table created';
    RAISE NOTICE '   - workload_alerts table created';
    RAISE NOTICE '   - file_requests updated with priority/complexity';
    RAISE NOTICE '   - Triggers and functions created';
    RAISE NOTICE '   - editor_workload_summary view created';
  END IF;
END $$;

COMMIT;

-- ============================================
-- SUCCESS!
-- ============================================
-- Run this migration with:
-- psql "postgresql://..." -f 20260111_workload_management.sql
-- ============================================
