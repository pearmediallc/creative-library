-- Add editor and buyer assignment to file requests
-- This allows automatic assignment of uploaded files to editors and buyers

ALTER TABLE file_requests
ADD COLUMN IF NOT EXISTS editor_id UUID REFERENCES editors(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_buyer_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_file_requests_editor ON file_requests(editor_id);
CREATE INDEX IF NOT EXISTS idx_file_requests_buyer ON file_requests(assigned_buyer_id);

COMMENT ON COLUMN file_requests.editor_id IS 'Editor to assign uploaded files to';
COMMENT ON COLUMN file_requests.assigned_buyer_id IS 'Buyer to assign uploaded files to';
