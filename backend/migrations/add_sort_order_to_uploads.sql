-- Add sort_order column for drag-to-reorder within file request folders
ALTER TABLE file_request_uploads ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
