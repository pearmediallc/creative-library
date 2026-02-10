-- Add Vertical Aliases for Common Variations
-- Date: 2026-02-10
-- Description: Handles variations like "Home Insurance" matching to "home"

DO $$
DECLARE
  home_head UUID;
  fallback_ids UUID[];
BEGIN
  -- Get the existing home vertical head
  SELECT head_editor_id, fallback_editor_ids
  INTO home_head, fallback_ids
  FROM vertical_heads
  WHERE vertical = 'home';

  IF home_head IS NOT NULL THEN
    -- Add "homeinsurance" alias
    INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
    VALUES ('homeinsurance', home_head, fallback_ids)
    ON CONFLICT (vertical)
    DO UPDATE SET
      head_editor_id = EXCLUDED.head_editor_id,
      fallback_editor_ids = EXCLUDED.fallback_editor_ids,
      updated_at = NOW();

    RAISE NOTICE '✓ Added homeinsurance alias → same head as home';
  END IF;
END $$;

-- Update migration runner script
COMMENT ON TABLE vertical_heads IS 'Vertical assignment with normalized matching (case-insensitive, ignores spaces/special chars)';
