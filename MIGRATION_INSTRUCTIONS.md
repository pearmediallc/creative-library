# User-Editor Linking Migration

## What This Fixes

Creative users (like Parmeet, Ritu) were unable to upload media because their names didn't appear in the editor dropdown. This migration links User accounts to Editor entities automatically.

## How to Run the Migration

### Option 1: Via Render Dashboard (Recommended)

1. Go to your Render Dashboard
2. Navigate to your backend service (creative-library)
3. Go to "Shell" tab
4. Run:
   ```bash
   npm run link-users-editors
   ```

### Option 2: Via Render CLI

If you have Render CLI installed:
```bash
render shell creative-library
npm run link-users-editors
```

### Option 3: Direct Command

```bash
node src/scripts/linkUsersToEditors.js
```

## What the Migration Does

1. **Adds `user_id` column** to `editors` table (links editors to user accounts)
2. **Creates Editor entities** for all existing creative users (Parmeet, Ritu, etc.)
3. **Links them automatically** via `user_id` foreign key
4. **Preserves existing editors** (SHUBH, MUNSHI remain unchanged)

## After Migration

✅ All creative users will appear in the editor dropdown
✅ They can upload media immediately
✅ Future creative users auto-get editor entities
✅ Admin can still manually create/manage editors

## Verification

After running the migration, check:

1. Login as a creative user (Ritu)
2. Go to Media Library → Upload File
3. Editor dropdown should now show: "All Editors", "munshi", "shubh", "RITUSINGH" (or whatever name was used)
4. Upload should work successfully

## Rollback

To rollback (not recommended, but if needed):
```sql
ALTER TABLE editors DROP COLUMN IF EXISTS user_id;
```

## Support

If you encounter issues:
1. Check backend logs in Render dashboard
2. Verify DATABASE_URL is set correctly
3. Ensure backend has database write permissions
