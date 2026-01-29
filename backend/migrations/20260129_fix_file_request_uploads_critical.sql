-- Critical Fix: file_request_uploads table schema mismatch
-- Date: 2026-01-29
-- Description: Fixes authenticated upload failures by ensuring proper schema

-- The file_request_uploads table has TWO conflicting purposes:
-- 1. Track individual file uploads (original schema with file_id)
-- 2. Track upload sessions (new schema with uploaded_by, upload_type)
--
-- SOLUTION: Keep BOTH schemas merged into one table

DO $$
BEGIN
  -- Ensure file_id column exists (for tracking actual files)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_request_uploads' AND column_name='file_id'
  ) THEN
    ALTER TABLE file_request_uploads
    ADD COLUMN file_id UUID REFERENCES media_files(id) ON DELETE CASCADE;

    RAISE NOTICE '✓ Added file_id column to file_request_uploads';
  END IF;

  -- Ensure uploaded_by column exists (for tracking who uploaded)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_request_uploads' AND column_name='uploaded_by'
  ) THEN
    ALTER TABLE file_request_uploads
    ADD COLUMN uploaded_by UUID REFERENCES users(id);

    RAISE NOTICE '✓ Added uploaded_by column to file_request_uploads';
  END IF;

  -- Ensure upload_type column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_request_uploads' AND column_name='upload_type'
  ) THEN
    ALTER TABLE file_request_uploads
    ADD COLUMN upload_type VARCHAR(20) CHECK (upload_type IN ('file', 'folder', 'session'));

    RAISE NOTICE '✓ Added upload_type column to file_request_uploads';
  END IF;

  -- Ensure file_count column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_request_uploads' AND column_name='file_count'
  ) THEN
    ALTER TABLE file_request_uploads
    ADD COLUMN file_count INTEGER DEFAULT 0;

    RAISE NOTICE '✓ Added file_count column to file_request_uploads';
  END IF;

  -- Ensure total_size_bytes column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_request_uploads' AND column_name='total_size_bytes'
  ) THEN
    ALTER TABLE file_request_uploads
    ADD COLUMN total_size_bytes BIGINT DEFAULT 0;

    RAISE NOTICE '✓ Added total_size_bytes column to file_request_uploads';
  END IF;

  -- Ensure editor_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_request_uploads' AND column_name='editor_id'
  ) THEN
    ALTER TABLE file_request_uploads
    ADD COLUMN editor_id UUID REFERENCES editors(id);

    RAISE NOTICE '✓ Added editor_id column to file_request_uploads';
  END IF;

  -- Ensure comments column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='file_request_uploads' AND column_name='comments'
  ) THEN
    ALTER TABLE file_request_uploads
    ADD COLUMN comments TEXT;

    RAISE NOTICE '✓ Added comments column to file_request_uploads';
  END IF;

  RAISE NOTICE '✅ file_request_uploads table schema fixed';
END $$;

-- Create index on file_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_file ON file_request_uploads(file_id) WHERE file_id IS NOT NULL;

-- Create index on uploaded_by if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_file_request_uploads_uploader ON file_request_uploads(uploaded_by) WHERE uploaded_by IS NOT NULL;

COMMENT ON TABLE file_request_uploads IS 'Tracks both upload sessions and individual files uploaded through file requests';
COMMENT ON COLUMN file_request_uploads.file_id IS 'Reference to the actual uploaded file (NULL for session records)';
COMMENT ON COLUMN file_request_uploads.uploaded_by IS 'User who performed the upload';
COMMENT ON COLUMN file_request_uploads.upload_type IS 'Type of upload: file, folder, or session';
