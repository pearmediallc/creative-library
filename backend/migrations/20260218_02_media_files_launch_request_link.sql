-- Migration: Add launch_request_upload_id to media_files
-- Allows media_files entries created from launch request uploads to be traced back
-- to the originating launch_request_uploads row (used for deduplication when
-- provisioning buyer media library folders).
-- NOTE: Requires launch_request_uploads table to exist (run 20260218_01_launch_requests.sql first).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'launch_request_uploads') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'media_files' AND column_name = 'launch_request_upload_id'
    ) THEN
      ALTER TABLE media_files
        ADD COLUMN launch_request_upload_id UUID
          REFERENCES launch_request_uploads(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_media_files_lr_upload_id
        ON media_files(launch_request_upload_id)
        WHERE launch_request_upload_id IS NOT NULL;

      RAISE NOTICE 'Added launch_request_upload_id to media_files';
    ELSE
      RAISE NOTICE 'launch_request_upload_id already exists in media_files -- skipping';
    END IF;
  ELSE
    RAISE NOTICE 'launch_request_uploads table does not exist -- skipping (run launch requests migration first)';
  END IF;
END$$;
