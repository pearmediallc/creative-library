-- Migration: Populate vertical_heads table with correct mappings
-- Maps verticals to their respective head editors based on email

DO $$
DECLARE
  v_bizop_user_id uuid;
  v_auto_user_id uuid;
  v_home_user_id uuid;
  v_guns_user_id uuid;
  v_refi_user_id uuid;
  v_medicare_user_id uuid;
BEGIN
  -- Get user IDs for each vertical head by email
  SELECT id INTO v_bizop_user_id FROM users WHERE email = 'aditya.nawal@pearmediall.com' LIMIT 1;
  SELECT id INTO v_auto_user_id FROM users WHERE email = 'priya.mishra@pearmediallc.com' LIMIT 1;
  SELECT id INTO v_home_user_id FROM users WHERE email = 'baljeet.singh@pearmediallc.com' LIMIT 1;
  SELECT id INTO v_guns_user_id FROM users WHERE email = 'pankaj.jain@pearmediallc.com' LIMIT 1;
  SELECT id INTO v_refi_user_id FROM users WHERE email = 'karan.singh@pearmediallc.com' LIMIT 1;
  SELECT id INTO v_medicare_user_id FROM users WHERE email = 'priya.mishra@pearmediallc.com' LIMIT 1;

  -- Upsert Bizop vertical head
  IF v_bizop_user_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('bizop', v_bizop_user_id)
    ON CONFLICT (vertical) DO UPDATE
    SET head_editor_id = EXCLUDED.head_editor_id,
        updated_at = NOW();
    RAISE NOTICE 'Set Bizop vertical head to user: %', v_bizop_user_id;
  ELSE
    RAISE WARNING 'User with email aditya.nawal@pearmediall.com not found for Bizop vertical';
  END IF;

  -- Upsert Auto Insurance vertical head
  IF v_auto_user_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('auto insurance', v_auto_user_id)
    ON CONFLICT (vertical) DO UPDATE
    SET head_editor_id = EXCLUDED.head_editor_id,
        updated_at = NOW();

    -- Also add alternate names for Auto
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('auto', v_auto_user_id)
    ON CONFLICT (vertical) DO UPDATE
    SET head_editor_id = EXCLUDED.head_editor_id,
        updated_at = NOW();

    RAISE NOTICE 'Set Auto Insurance vertical head to user: %', v_auto_user_id;
  ELSE
    RAISE WARNING 'User with email priya.mishra@pearmediallc.com not found for Auto Insurance vertical';
  END IF;

  -- Upsert Home Insurance vertical head
  IF v_home_user_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('home insurance', v_home_user_id)
    ON CONFLICT (vertical) DO UPDATE
    SET head_editor_id = EXCLUDED.head_editor_id,
        updated_at = NOW();

    -- Also add alternate names for Home
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('home', v_home_user_id)
    ON CONFLICT (vertical) DO UPDATE
    SET head_editor_id = EXCLUDED.head_editor_id,
        updated_at = NOW();

    RAISE NOTICE 'Set Home Insurance vertical head to user: %', v_home_user_id;
  ELSE
    RAISE WARNING 'User with email baljeet.singh@pearmediallc.com not found for Home Insurance vertical';
  END IF;

  -- Upsert Guns vertical head
  IF v_guns_user_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('guns', v_guns_user_id)
    ON CONFLICT (vertical) DO UPDATE
    SET head_editor_id = EXCLUDED.head_editor_id,
        updated_at = NOW();
    RAISE NOTICE 'Set Guns vertical head to user: %', v_guns_user_id;
  ELSE
    RAISE WARNING 'User with email pankaj.jain@pearmediallc.com not found for Guns vertical';
  END IF;

  -- Upsert Refinance vertical head
  IF v_refi_user_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('refinance', v_refi_user_id)
    ON CONFLICT (vertical) DO UPDATE
    SET head_editor_id = EXCLUDED.head_editor_id,
        updated_at = NOW();

    -- Also add alternate names for Refi
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('refi', v_refi_user_id)
    ON CONFLICT (vertical) DO UPDATE
    SET head_editor_id = EXCLUDED.head_editor_id,
        updated_at = NOW();

    RAISE NOTICE 'Set Refinance vertical head to user: %', v_refi_user_id;
  ELSE
    RAISE WARNING 'User with email karan.singh@pearmediallc.com not found for Refinance vertical';
  END IF;

  -- Upsert Medicare vertical head
  IF v_medicare_user_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('medicare', v_medicare_user_id)
    ON CONFLICT (vertical) DO UPDATE
    SET head_editor_id = EXCLUDED.head_editor_id,
        updated_at = NOW();
    RAISE NOTICE 'Set Medicare vertical head to user: %', v_medicare_user_id;
  ELSE
    RAISE WARNING 'User with email priya.mishra@pearmediallc.com not found for Medicare vertical';
  END IF;

  RAISE NOTICE 'Vertical heads population complete';
END$$;

-- Display current vertical heads mapping
SELECT
  vh.vertical,
  u.name as head_name,
  u.email as head_email,
  vh.created_at,
  vh.updated_at
FROM vertical_heads vh
JOIN users u ON u.id = vh.head_editor_id
ORDER BY vh.vertical;
