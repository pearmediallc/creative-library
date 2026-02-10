-- Populate Vertical Heads Mapping
-- Date: 2026-01-29
-- Description: Sets up vertical head assignments based on team structure

-- First, get the user IDs for each vertical head by email
DO $$
DECLARE
  aditya_id UUID;
  priya_id UUID;
  baljeet_id UUID;
  pankaj_id UUID;
  karan_id UUID;
  ritu_id UUID;
  parmeet_id UUID;
BEGIN
  -- Get user IDs by email
  SELECT id INTO aditya_id FROM users WHERE email = 'aditya.nawal@pearmediallc.com';
  SELECT id INTO priya_id FROM users WHERE email = 'priya.mishra@pearmediallc.com';
  SELECT id INTO baljeet_id FROM users WHERE email = 'baljeet.singh@pearmediallc.com';
  SELECT id INTO pankaj_id FROM users WHERE email = 'pankaj.jain@pearmediallc.com';
  SELECT id INTO karan_id FROM users WHERE email = 'karan.singh@pearmediallc.com';
  SELECT id INTO ritu_id FROM users WHERE email = 'ritu@pearmediallc.com';
  SELECT id INTO parmeet_id FROM users WHERE email = 'parmeet@pearmediallc.com';

  -- Log which users were found
  RAISE NOTICE '=== User IDs Found ===';
  RAISE NOTICE 'Aditya (bizop): %', COALESCE(aditya_id::text, 'NOT FOUND');
  RAISE NOTICE 'Priya (auto/medicare): %', COALESCE(priya_id::text, 'NOT FOUND');
  RAISE NOTICE 'Baljeet (home): %', COALESCE(baljeet_id::text, 'NOT FOUND');
  RAISE NOTICE 'Pankaj (guns): %', COALESCE(pankaj_id::text, 'NOT FOUND');
  RAISE NOTICE 'Karan (refi): %', COALESCE(karan_id::text, 'NOT FOUND');
  RAISE NOTICE 'Ritu (fallback): %', COALESCE(ritu_id::text, 'NOT FOUND');
  RAISE NOTICE 'Parmeet (fallback): %', COALESCE(parmeet_id::text, 'NOT FOUND');

  -- Build fallback array (Ritu & Parmeet)
  -- Only include users that were found
  DECLARE
    fallback_ids UUID[] := ARRAY[]::UUID[];
  BEGIN
    IF ritu_id IS NOT NULL THEN
      fallback_ids := array_append(fallback_ids, ritu_id);
    END IF;
    IF parmeet_id IS NOT NULL THEN
      fallback_ids := array_append(fallback_ids, parmeet_id);
    END IF;

    RAISE NOTICE '=== Inserting Vertical Heads ===';

    -- Insert/Update vertical heads
    -- bizop -> Aditya
    IF aditya_id IS NOT NULL THEN
      INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
      VALUES ('bizop', aditya_id, fallback_ids)
      ON CONFLICT (vertical)
      DO UPDATE SET
        head_editor_id = EXCLUDED.head_editor_id,
        fallback_editor_ids = EXCLUDED.fallback_editor_ids,
        updated_at = NOW();
      RAISE NOTICE '✓ bizop -> Aditya';
    ELSE
      RAISE WARNING '✗ Could not assign bizop - Aditya not found';
    END IF;

    -- auto -> Priya
    IF priya_id IS NOT NULL THEN
      INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
      VALUES ('auto', priya_id, fallback_ids)
      ON CONFLICT (vertical)
      DO UPDATE SET
        head_editor_id = EXCLUDED.head_editor_id,
        fallback_editor_ids = EXCLUDED.fallback_editor_ids,
        updated_at = NOW();
      RAISE NOTICE '✓ auto -> Priya';
    ELSE
      RAISE WARNING '✗ Could not assign auto - Priya not found';
    END IF;

    -- home -> Baljeet
    IF baljeet_id IS NOT NULL THEN
      INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
      VALUES ('home', baljeet_id, fallback_ids)
      ON CONFLICT (vertical)
      DO UPDATE SET
        head_editor_id = EXCLUDED.head_editor_id,
        fallback_editor_ids = EXCLUDED.fallback_editor_ids,
        updated_at = NOW();
      RAISE NOTICE '✓ home -> Baljeet';
    ELSE
      RAISE WARNING '✗ Could not assign home - Baljeet not found';
    END IF;

    -- guns -> Pankaj
    IF pankaj_id IS NOT NULL THEN
      INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
      VALUES ('guns', pankaj_id, fallback_ids)
      ON CONFLICT (vertical)
      DO UPDATE SET
        head_editor_id = EXCLUDED.head_editor_id,
        fallback_editor_ids = EXCLUDED.fallback_editor_ids,
        updated_at = NOW();
      RAISE NOTICE '✓ guns -> Pankaj';
    ELSE
      RAISE WARNING '✗ Could not assign guns - Pankaj not found';
    END IF;

    -- refi -> Karan
    IF karan_id IS NOT NULL THEN
      INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
      VALUES ('refi', karan_id, fallback_ids)
      ON CONFLICT (vertical)
      DO UPDATE SET
        head_editor_id = EXCLUDED.head_editor_id,
        fallback_editor_ids = EXCLUDED.fallback_editor_ids,
        updated_at = NOW();
      RAISE NOTICE '✓ refi -> Karan';
    ELSE
      RAISE WARNING '✗ Could not assign refi - Karan not found';
    END IF;

    -- medicare -> Priya
    IF priya_id IS NOT NULL THEN
      INSERT INTO vertical_heads (vertical, head_editor_id, fallback_editor_ids)
      VALUES ('medicare', priya_id, fallback_ids)
      ON CONFLICT (vertical)
      DO UPDATE SET
        head_editor_id = EXCLUDED.head_editor_id,
        fallback_editor_ids = EXCLUDED.fallback_editor_ids,
        updated_at = NOW();
      RAISE NOTICE '✓ medicare -> Priya';
    ELSE
      RAISE WARNING '✗ Could not assign medicare - Priya not found';
    END IF;

    RAISE NOTICE '=== Vertical Heads Setup Complete ===';
  END;
END $$;

-- Verify the setup
DO $$
DECLARE
  vertical_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Current Vertical Heads Configuration ===';
  FOR vertical_record IN
    SELECT
      vh.vertical,
      u.name as head_name,
      u.email as head_email,
      (SELECT COUNT(*) FROM unnest(vh.fallback_editor_ids) as fb_id
       JOIN users u2 ON u2.id = fb_id) as fallback_count
    FROM vertical_heads vh
    LEFT JOIN users u ON vh.head_editor_id = u.id
    ORDER BY vh.vertical
  LOOP
    RAISE NOTICE '  % -> % (%) [% fallbacks]',
      vertical_record.vertical,
      COALESCE(vertical_record.head_name, 'NOT ASSIGNED'),
      COALESCE(vertical_record.head_email, 'N/A'),
      vertical_record.fallback_count;
  END LOOP;
END $$;

-- Add constraint to ensure vertical is unique
ALTER TABLE vertical_heads DROP CONSTRAINT IF EXISTS vertical_heads_vertical_key;
ALTER TABLE vertical_heads ADD CONSTRAINT vertical_heads_vertical_key UNIQUE (vertical);

COMMENT ON TABLE vertical_heads IS 'Maps verticals to their assigned head editors with fallback editors';
COMMENT ON COLUMN vertical_heads.vertical IS 'Vertical name (bizop, auto, home, guns, refi, medicare)';
COMMENT ON COLUMN vertical_heads.head_editor_id IS 'User ID of the vertical head editor';
COMMENT ON COLUMN vertical_heads.fallback_editor_ids IS 'Array of user IDs for fallback editors (Ritu & Parmeet)';
