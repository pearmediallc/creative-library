-- ============================================================================
-- FIX FILE REQUESTS TABLE SCHEMA
-- Date: 2026-01-11
-- Description: Add missing created_by column and verify all columns exist
-- ============================================================================

-- Add created_by column if it doesn't exist
ALTER TABLE file_requests
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE CASCADE;

-- Add other potentially missing columns
ALTER TABLE file_requests
  ADD COLUMN IF NOT EXISTS request_token VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS delivery_note TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_file_requests_created_by ON file_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_file_requests_request_token ON file_requests(request_token);
CREATE INDEX IF NOT EXISTS idx_file_requests_is_active ON file_requests(is_active);

-- Verification query
SELECT 'File requests schema fix completed!' as status;

-- Show all columns in file_requests table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'file_requests'
ORDER BY ordinal_position;
