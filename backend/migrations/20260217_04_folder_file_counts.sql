-- Migration: Folder File Count Functions
-- Created: 2026-02-17
-- Description: Add functions to count files in folders (including nested) and
--              display file counts in folder listings

-- ============================================================================
-- FUNCTION: Count Files in Folder (Direct Children Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION count_files_in_folder(folder_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM media_files
  WHERE folder_id = folder_uuid
    AND is_deleted = FALSE;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- FUNCTION: Count Files in Folder (Including Nested Subfolders)
-- ============================================================================

CREATE OR REPLACE FUNCTION count_files_in_folder_recursive(folder_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  total_count INTEGER := 0;
  child_count INTEGER;
  child_folder RECORD;
BEGIN
  -- Count files directly in this folder
  SELECT COUNT(*) INTO total_count
  FROM media_files
  WHERE folder_id = folder_uuid
    AND is_deleted = FALSE;

  -- Count files in each child folder recursively
  FOR child_folder IN
    SELECT id FROM folders
    WHERE parent_folder_id = folder_uuid
      AND is_deleted = FALSE
  LOOP
    child_count := count_files_in_folder_recursive(child_folder.id);
    total_count := total_count + child_count;
  END LOOP;

  RETURN total_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get Folder Statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_folder_stats(folder_uuid UUID)
RETURNS TABLE (
  direct_file_count INTEGER,
  recursive_file_count INTEGER,
  direct_subfolder_count INTEGER,
  total_size_bytes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    count_files_in_folder(folder_uuid) as direct_file_count,
    count_files_in_folder_recursive(folder_uuid) as recursive_file_count,
    (SELECT COUNT(*)::INTEGER
     FROM folders
     WHERE parent_folder_id = folder_uuid
       AND is_deleted = FALSE
    ) as direct_subfolder_count,
    (SELECT COALESCE(SUM(file_size), 0)::BIGINT
     FROM media_files
     WHERE folder_id = folder_uuid
       AND is_deleted = FALSE
    ) as total_size_bytes;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ENHANCED VIEW: Folders with File Counts
-- ============================================================================

CREATE OR REPLACE VIEW folders_with_counts AS
SELECT
  f.*,
  count_files_in_folder(f.id) as file_count,
  count_files_in_folder_recursive(f.id) as file_count_recursive,
  (SELECT COUNT(*)::INTEGER
   FROM folders child
   WHERE child.parent_folder_id = f.id
     AND child.is_deleted = FALSE
  ) as subfolder_count,
  (SELECT COALESCE(SUM(mf.file_size), 0)::BIGINT
   FROM media_files mf
   WHERE mf.folder_id = f.id
     AND mf.is_deleted = FALSE
  ) as total_size_bytes,
  u.name as owner_name,
  u.email as owner_email
FROM folders f
LEFT JOIN users u ON f.owner_id = u.id
WHERE f.is_deleted = FALSE;

-- ============================================================================
-- FUNCTION: Get File Request Folder Structure with Counts
-- ============================================================================

CREATE OR REPLACE FUNCTION get_file_request_folder_tree(request_uuid UUID)
RETURNS TABLE (
  folder_id UUID,
  folder_name TEXT,
  folder_path TEXT,
  parent_folder_id UUID,
  file_count INTEGER,
  total_size_bytes BIGINT,
  created_at TIMESTAMP,
  level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE folder_tree AS (
    -- Get the root folder for this request
    SELECT
      f.id as folder_id,
      f.name as folder_name,
      f.name as folder_path,
      f.parent_folder_id,
      count_files_in_folder(f.id) as file_count,
      (SELECT COALESCE(SUM(file_size), 0)::BIGINT
       FROM media_files
       WHERE folder_id = f.id AND is_deleted = FALSE
      ) as total_size_bytes,
      f.created_at,
      0 as level
    FROM folders f
    JOIN file_requests fr ON fr.folder_id = f.id
    WHERE fr.id = request_uuid
      AND f.is_deleted = FALSE

    UNION ALL

    -- Get child folders recursively
    SELECT
      child.id as folder_id,
      child.name as folder_name,
      (parent.folder_path || ' / ' || child.name) as folder_path,
      child.parent_folder_id,
      count_files_in_folder(child.id) as file_count,
      (SELECT COALESCE(SUM(file_size), 0)::BIGINT
       FROM media_files
       WHERE folder_id = child.id AND is_deleted = FALSE
      ) as total_size_bytes,
      child.created_at,
      parent.level + 1 as level
    FROM folders child
    JOIN folder_tree parent ON child.parent_folder_id = parent.folder_id
    WHERE child.is_deleted = FALSE
  )
  SELECT * FROM folder_tree
  ORDER BY level, folder_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- INDEX: Optimize folder traversal
-- ============================================================================

-- Index for parent_folder_id lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_folders_parent_folder_id
  ON folders(parent_folder_id)
  WHERE is_deleted = FALSE;

-- Index for folder_id on media_files (if not exists)
CREATE INDEX IF NOT EXISTS idx_media_files_folder_id_not_deleted
  ON media_files(folder_id)
  WHERE is_deleted = FALSE;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION count_files_in_folder IS 'Counts files directly in a folder (non-recursive)';
COMMENT ON FUNCTION count_files_in_folder_recursive IS 'Counts all files in a folder including nested subfolders';
COMMENT ON FUNCTION get_folder_stats IS 'Returns comprehensive statistics for a folder';
COMMENT ON VIEW folders_with_counts IS 'Enhanced folder view with file counts and sizes';
COMMENT ON FUNCTION get_file_request_folder_tree IS 'Returns hierarchical folder structure for a file request with file counts';
