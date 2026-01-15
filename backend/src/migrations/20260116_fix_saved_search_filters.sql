-- Fix corrupted saved search filters
-- Replace "[object Object]" with empty JSON object "{}"

UPDATE saved_searches
SET filters = '{}'::jsonb
WHERE filters::text = '"[object Object]"';

-- Log the fix
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % corrupted saved search filter(s)', affected_count;
END $$;
