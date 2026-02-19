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

  -- Upsert Bizop vertical head (update when we have actual requests)
  -- Currently no Bizop requests in database
  -- Will be added when requests use this vertical

  -- Upsert Auto Insurance vertical head
  IF v_auto_user_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('Auto Insurance', v_auto_user_id)
    ON CONFLICT (vertical) DO UPDATE
    SET head_editor_id = EXCLUDED.head_editor_id,
        updated_at = NOW();

    RAISE NOTICE 'Set Auto Insurance vertical head to user: %', v_auto_user_id;
  ELSE
    RAISE WARNING 'User with email priya.mishra@pearmediallc.com not found for Auto Insurance vertical';
  END IF;

  -- Delete old lowercase/alternate entries
  DELETE FROM vertical_heads WHERE vertical IN ('auto', 'auto insurance');

  -- Upsert Home Insurance vertical head
  IF v_home_user_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('Home Insurance', v_home_user_id)
    ON CONFLICT (vertical) DO UPDATE
    SET head_editor_id = EXCLUDED.head_editor_id,
        updated_at = NOW();

    RAISE NOTICE 'Set Home Insurance vertical head to user: %', v_home_user_id;
  ELSE
    RAISE WARNING 'User with email baljeet.singh@pearmediallc.com not found for Home Insurance vertical';
  END IF;

  -- Delete old lowercase/alternate entries
  DELETE FROM vertical_heads WHERE vertical IN ('home', 'home insurance');

  -- Upsert Guns vertical head (update when we have actual requests)
  -- Currently no Guns requests in database
  -- Will be added when requests use this vertical

  -- Upsert Refinance vertical head (update when we have actual requests)
  -- Currently no Refinance requests in database
  -- Will be added when requests use this vertical

  -- Upsert Medicare vertical head (update when we have actual requests)
  -- Currently no Medicare requests in database
  -- Will be added when requests use this vertical

  -- Clean up any remaining duplicate/lowercase entries
  DELETE FROM vertical_heads WHERE vertical IN ('bizop', 'guns', 'medicare', 'refi', 'refinance');

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
