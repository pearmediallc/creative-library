-- Migration: Add updated_at column to launch_request_editors
-- Required by the new assignEditors functionality that preserves editor history

DO $$
BEGIN
  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_request_editors' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE launch_request_editors
      ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

    -- Set updated_at for existing rows to match assigned_at
    UPDATE launch_request_editors
    SET updated_at = assigned_at
    WHERE updated_at IS NULL;

    RAISE NOTICE 'Added updated_at column to launch_request_editors';
  ELSE
    RAISE NOTICE 'updated_at already exists in launch_request_editors -- skipping';
  END IF;
END$$;

-- Create trigger to auto-update timestamp on UPDATE
CREATE OR REPLACE FUNCTION update_launch_request_editors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_launch_request_editors_updated_at ON launch_request_editors;

CREATE TRIGGER trigger_update_launch_request_editors_updated_at
BEFORE UPDATE ON launch_request_editors
FOR EACH ROW
EXECUTE FUNCTION update_launch_request_editors_updated_at();
