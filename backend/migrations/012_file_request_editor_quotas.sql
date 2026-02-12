-- Migration: Per-editor deliverables quota + uploaded counters
-- Date: 2026-02-13

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_editors' AND column_name='deliverables_quota') THEN
    ALTER TABLE file_request_editors ADD COLUMN deliverables_quota INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_editors' AND column_name='deliverables_uploaded') THEN
    ALTER TABLE file_request_editors ADD COLUMN deliverables_uploaded INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_editors' AND column_name='deliverables_completed_at') THEN
    ALTER TABLE file_request_editors ADD COLUMN deliverables_completed_at TIMESTAMP;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fre_deliverables_quota ON file_request_editors(deliverables_quota);
