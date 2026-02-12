-- Migration: File request deliverables progress tracking
-- Date: 2026-02-12

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='deliverables_required') THEN
    ALTER TABLE file_requests ADD COLUMN deliverables_required INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='deliverables_type') THEN
    ALTER TABLE file_requests ADD COLUMN deliverables_type VARCHAR(20) DEFAULT 'file';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='deliverables_completed_at') THEN
    ALTER TABLE file_requests ADD COLUMN deliverables_completed_at TIMESTAMP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='deliverables_notified_at') THEN
    ALTER TABLE file_requests ADD COLUMN deliverables_notified_at TIMESTAMP;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_file_requests_deliverables_required ON file_requests(deliverables_required);
