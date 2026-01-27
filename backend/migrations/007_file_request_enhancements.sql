-- Migration: File Request Enhancements
-- Purpose: Add status tracking, upload history, and improved organization
-- Date: 2026-01-24

-- 1. Add status and lifecycle columns to file_requests
DO $$
BEGIN
  -- Add columns one by one to ensure they exist before constraints
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

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='closed_at') THEN
    ALTER TABLE file_requests ADD COLUMN closed_at TIMESTAMP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='closed_by') THEN
    ALTER TABLE file_requests ADD COLUMN closed_by UUID REFERENCES users(id);
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
END $$;

-- Add constraint separately (if column already exists, this will be ignored)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'file_requests_status_check'
  ) THEN
    ALTER TABLE file_requests
    ADD CONSTRAINT file_requests_status_check
    CHECK (status IN ('open', 'in_progress', 'uploaded', 'launched', 'closed', 'reopened'));
  END IF;
END $$;

-- 2. Create upload tracking table (or add missing columns if table exists)
DO $$
BEGIN
  -- Create table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'file_request_uploads') THEN
    CREATE TABLE file_request_uploads (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      file_request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
      uploaded_by UUID NOT NULL REFERENCES users(id),
      upload_type VARCHAR(20) NOT NULL CHECK (upload_type IN ('file', 'folder')),
      folder_path TEXT,
      folder_name TEXT,
      file_count INTEGER DEFAULT 0,
      total_size_bytes BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP,
      deleted_by UUID REFERENCES users(id)
    );
  ELSE
    -- Table exists, add missing columns if needed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='uploaded_by') THEN
      -- Add as nullable first, then populate with data
      ALTER TABLE file_request_uploads ADD COLUMN uploaded_by UUID REFERENCES users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='upload_type') THEN
      -- Add as nullable first (can't add NOT NULL to existing table with data)
      ALTER TABLE file_request_uploads ADD COLUMN upload_type VARCHAR(20) CHECK (upload_type IN ('file', 'folder'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='folder_path') THEN
      ALTER TABLE file_request_uploads ADD COLUMN folder_path TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='folder_name') THEN
      ALTER TABLE file_request_uploads ADD COLUMN folder_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='file_count') THEN
      ALTER TABLE file_request_uploads ADD COLUMN file_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_request_uploads' AND column_name='total_size_bytes') THEN
      ALTER TABLE file_request_uploads ADD COLUMN total_size_bytes BIGINT DEFAULT 0;
    END IF;
  END IF;
END $$;

-- 3. Add upload_session_id to media_files
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_files' AND column_name='upload_session_id') THEN
    ALTER TABLE media_files ADD COLUMN upload_session_id UUID;
  END IF;

  -- Add foreign key constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_files_upload_session_id_fkey'
  ) THEN
    ALTER TABLE media_files
    ADD CONSTRAINT media_files_upload_session_id_fkey
    FOREIGN KEY (upload_session_id) REFERENCES file_request_uploads(id);
  END IF;
END $$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_requests_status ON file_requests(status);
CREATE INDEX IF NOT EXISTS idx_file_requests_uploaded_at ON file_requests(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_request ON file_request_uploads(file_request_id);
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_user ON file_request_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_created ON file_request_uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_media_files_upload_session ON media_files(upload_session_id);

-- 5. Migrate existing data
UPDATE file_requests
SET status = CASE
  WHEN completed_at IS NOT NULL THEN 'closed'
  WHEN array_length(assigned_editors, 1) > 0 THEN 'in_progress'
  ELSE 'open'
END
WHERE status IS NULL OR status = 'open';

UPDATE file_requests
SET closed_at = completed_at, closed_by = created_by
WHERE completed_at IS NOT NULL AND closed_at IS NULL;
