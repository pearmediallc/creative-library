-- Migration: Add media_folder_id to launch_request_buyers
-- Stores the provisioned media library subfolder for each buyer
-- so we can push new uploads into it without re-creating the folder structure.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_request_buyers' AND column_name = 'media_folder_id'
  ) THEN
    ALTER TABLE launch_request_buyers
      ADD COLUMN media_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_lrb_media_folder
      ON launch_request_buyers(media_folder_id)
      WHERE media_folder_id IS NOT NULL;

    RAISE NOTICE 'Added media_folder_id to launch_request_buyers';
  ELSE
    RAISE NOTICE 'media_folder_id already exists in launch_request_buyers -- skipping';
  END IF;
END$$;
