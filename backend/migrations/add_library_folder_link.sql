-- Link file_request_folders to media library folders
ALTER TABLE file_request_folders ADD COLUMN IF NOT EXISTS library_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
