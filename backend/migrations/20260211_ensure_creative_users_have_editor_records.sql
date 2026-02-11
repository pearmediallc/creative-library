-- Ensure Creative Users Have Editor Records
-- Date: 2026-02-11
-- Description: Creates editor records for all creative role users who don't have one

DO $$
DECLARE
  user_record RECORD;
  new_editor_id UUID;
BEGIN
  RAISE NOTICE '=== Creating Editor Records for Creative Users ===';

  FOR user_record IN
    SELECT id, name, email
    FROM users
    WHERE role = 'creative'
      AND id NOT IN (SELECT user_id FROM editors WHERE user_id IS NOT NULL)
  LOOP
    -- Create editor record
    INSERT INTO editors (user_id, name, display_name, is_active)
    VALUES (
      user_record.id,
      user_record.name,
      user_record.name,  -- display_name same as name
      TRUE
    )
    RETURNING id INTO new_editor_id;

    RAISE NOTICE '✓ Created editor for: % (%) - editor_id: %',
      user_record.name,
      user_record.email,
      new_editor_id;
  END LOOP;

  RAISE NOTICE '=== Verification ===';
  RAISE NOTICE 'Total creative users: %', (SELECT COUNT(*) FROM users WHERE role = 'creative');
  RAISE NOTICE 'Total editors: %', (SELECT COUNT(*) FROM editors);
  RAISE NOTICE 'Creative users WITHOUT editor record: %',
    (SELECT COUNT(*) FROM users
     WHERE role = 'creative'
       AND id NOT IN (SELECT user_id FROM editors WHERE user_id IS NOT NULL));

END $$;

-- Show all creative users and their editor status
SELECT
  u.name,
  u.email,
  u.role,
  e.id as editor_id,
  e.is_active,
  CASE
    WHEN e.id IS NULL THEN '❌ NO EDITOR RECORD'
    WHEN e.is_active THEN '✅ ACTIVE EDITOR'
    ELSE '⚠️ INACTIVE EDITOR'
  END as status
FROM users u
LEFT JOIN editors e ON e.user_id = u.id
WHERE u.role = 'creative'
ORDER BY u.name;
