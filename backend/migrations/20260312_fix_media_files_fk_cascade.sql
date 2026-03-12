-- Fix: media_files.upload_session_id FK missing ON DELETE SET NULL
-- This causes "foreign key constraint violation" when deleting file requests
-- SET NULL keeps media files in library but unlinks them from deleted request uploads

ALTER TABLE media_files
DROP CONSTRAINT IF EXISTS media_files_upload_session_id_fkey;

ALTER TABLE media_files
ADD CONSTRAINT media_files_upload_session_id_fkey
FOREIGN KEY (upload_session_id) REFERENCES file_request_uploads(id) ON DELETE SET NULL;
