-- Migration: Backfill template-management permission for buyer team members
-- Date: 2026-02-13

UPDATE team_members tm
SET can_manage_templates = TRUE
FROM users u
WHERE tm.user_id = u.id
  AND u.role = 'buyer'
  AND tm.team_role <> 'guest'
  AND tm.can_manage_templates = FALSE;
