-- Migration: Fix file request upload tracking + deletion history
-- Date: 2026-02-12
-- Goal:
-- 1) Treat file_request_uploads as "upload sessions" (can have 1+ media_files via media_files.upload_session_id)
-- 2) Preserve history when a media file is deleted by storing snapshot metadata
-- 3) Support soft-delete of upload sessions (tracks removals)

DO $$
BEGIN
  -- Ensure lifecycle/status columns exist on file_requests (safe no-op if already applied)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='status') THEN
    ALTER TABLE file_requests ADD COLUMN status VARCHAR(20) DEFAULT 'open';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='uploaded_at') THEN
    ALTER TABLE file_requests ADD COLUMN uploaded_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='uploaded_by') THEN
    ALTER TABLE file_requests ADD COLUMN uploaded_by UUID REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='launched_at') THEN
    ALTER TABLE file_requests ADD COLUMN launched_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='launched_by') THEN
    ALTER TABLE file_requests ADD COLUMN launched_by UUID REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='reopened_at') THEN
    ALTER TABLE file_requests ADD COLUMN reopened_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='reopened_by') THEN
    ALTER TABLE file_requests ADD COLUMN reopened_by UUID REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='reopen_count') THEN
    ALTER TABLE file_requests ADD COLUMN reopen_count INTEGER DEFAULT 0;
  END IF;

  -- file_request_uploads: add missing columns needed for session + soft-delete + snapshots
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='uploaded_by') THEN
    ALTER TABLE file_request_uploads ADD COLUMN uploaded_by UUID REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='upload_type') THEN
    ALTER TABLE file_request_uploads ADD COLUMN upload_type VARCHAR(20) CHECK (upload_type IN ('file','folder','session'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='file_count') THEN
    ALTER TABLE file_request_uploads ADD COLUMN file_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='total_size_bytes') THEN
    ALTER TABLE file_request_uploads ADD COLUMN total_size_bytes BIGINT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='folder_path') THEN
    ALTER TABLE file_request_uploads ADD COLUMN folder_path TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='comments') THEN
    ALTER TABLE file_request_uploads ADD COLUMN comments TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='editor_id') THEN
    ALTER TABLE file_request_uploads ADD COLUMN editor_id UUID REFERENCES editors(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='uploaded_by_email') THEN
    ALTER TABLE file_request_uploads ADD COLUMN uploaded_by_email VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='uploaded_by_name') THEN
    ALTER TABLE file_request_uploads ADD COLUMN uploaded_by_name VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='is_deleted') THEN
    ALTER TABLE file_request_uploads ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='deleted_at') THEN
    ALTER TABLE file_request_uploads ADD COLUMN deleted_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='deleted_by') THEN
    ALTER TABLE file_request_uploads ADD COLUMN deleted_by UUID REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='files_metadata') THEN
    ALTER TABLE file_request_uploads ADD COLUMN files_metadata JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Make file_id nullable (legacy schema had NOT NULL). We no longer rely on it for sessions.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_request_uploads' AND column_name='file_id' AND is_nullable='NO'
  ) THEN
    ALTER TABLE file_request_uploads ALTER COLUMN file_id DROP NOT NULL;
  END IF;
END $$;

-- Ensure status check constraint exists (safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'file_requests_status_check'
  ) THEN
    ALTER TABLE file_requests
    ADD CONSTRAINT file_requests_status_check
    CHECK (status IN ('open','in_progress','uploaded','launched','closed','reopened'));
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_request_created ON file_request_uploads(file_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_request_not_deleted ON file_request_uploads(file_request_id) WHERE is_deleted = FALSE;
