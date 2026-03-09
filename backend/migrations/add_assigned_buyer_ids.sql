-- Add assigned_buyer_ids array column for multi-buyer support
ALTER TABLE file_requests ADD COLUMN IF NOT EXISTS assigned_buyer_ids UUID[];

-- Backfill existing single buyer assignments into the array
UPDATE file_requests
SET assigned_buyer_ids = ARRAY[assigned_buyer_id]
WHERE assigned_buyer_id IS NOT NULL AND assigned_buyer_ids IS NULL;

-- Add index for array lookups
CREATE INDEX IF NOT EXISTS idx_file_requests_buyer_ids ON file_requests USING GIN(assigned_buyer_ids);

COMMENT ON COLUMN file_requests.assigned_buyer_ids IS 'Array of buyer IDs assigned to this file request (multi-buyer support)';
