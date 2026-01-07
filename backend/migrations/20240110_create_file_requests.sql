-- File Request Workflow System
-- Allows users to request file uploads from external parties

-- File requests table
CREATE TABLE IF NOT EXISTS file_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  request_token VARCHAR(64) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  deadline TIMESTAMP,
  allow_multiple_uploads BOOLEAN DEFAULT TRUE,
  require_email BOOLEAN DEFAULT FALSE,
  custom_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  closed_by UUID REFERENCES users(id)
);

CREATE INDEX idx_file_requests_token ON file_requests(request_token);
CREATE INDEX idx_file_requests_created_by ON file_requests(created_by);
CREATE INDEX idx_file_requests_active ON file_requests(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_file_requests_folder ON file_requests(folder_id);

-- Uploaded files for requests
CREATE TABLE IF NOT EXISTS file_request_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  uploaded_by_email VARCHAR(255),
  uploaded_by_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_file_request_uploads_request ON file_request_uploads(file_request_id);
CREATE INDEX idx_file_request_uploads_file ON file_request_uploads(file_id);

-- Add comments
COMMENT ON TABLE file_requests IS 'File upload requests created by users to collect files from external parties';
COMMENT ON TABLE file_request_uploads IS 'Tracks files uploaded through file request links';
COMMENT ON COLUMN file_requests.request_token IS 'Unique token for public access link';
COMMENT ON COLUMN file_requests.is_active IS 'Whether the request is accepting uploads';
COMMENT ON COLUMN file_requests.allow_multiple_uploads IS 'Whether multiple files can be uploaded by same person';
COMMENT ON COLUMN file_requests.require_email IS 'Whether uploader email is required';
