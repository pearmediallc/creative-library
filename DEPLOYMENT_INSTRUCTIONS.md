# Critical Fixes Deployment Instructions

## Date: January 15, 2026

---

## ✅ FIXES IMPLEMENTED (All Complete)

### 1. Database Column Fixes
- ✅ `team_members.role` → `team_members.team_role`
- ✅ Added `comments` column to `file_request_uploads`

### 2. Folder Navigation Fix
- ✅ MediaLibrary now supports URL parameter `?folderId=`
- ✅ Backend already filters by folder_id correctly
- ✅ Folder contents API working properly

### 3. Slack Folder Sharing Fix
- ✅ ShareDialog now generates correct URLs: `/media?folderId={id}`
- ✅ "View Folder" links from Slack will open correct folder

### 4. Frontend URL Parameter Handling
- ✅ MediaLibrary detects `?folderId=` on mount and navigates to folder

---

## 🚀 DEPLOYMENT STEPS FOR RENDER

### Step 1: Deploy Code Changes

```bash
# Code is already pushed to GitHub (commit 1aadae5)
# Render will auto-deploy from main branch
```

### Step 2: Run Database Migration on Render

**Option A: Using Node.js Migration Script (RECOMMENDED)**

1. Go to Render Dashboard → Your Backend Service
2. Click "Shell" tab
3. Run the following command:

```bash
node backend/migrations/run-critical-fix.js
```

Expected output:
```
═══════════════════════════════════════════════════
  CRITICAL DATABASE MIGRATION
  Date: 2026-01-15
═══════════════════════════════════════════════════

🔄 Connecting to database...
✅ Connected to database

📋 Starting migration...

🔧 Fix 1: Checking team_members.role column...
   → Column "role" exists, renaming to "team_role"...
   ✅ Column renamed: role → team_role

🔧 Fix 2: Checking file_request_uploads.comments column...
   → Column "comments" does not exist, adding...
   ✅ Column "comments" added successfully

🔍 Verifying changes...
   ✅ team_members.team_role exists
   ✅ file_request_uploads.comments exists

✅ All columns verified successfully!

✅ Migration committed successfully

📊 MIGRATION SUMMARY:
   • team_members.role → team_members.team_role ✅
   • file_request_uploads.comments added ✅

🎉 Migration completed successfully!

✅ Script completed successfully
```

**Option B: Using psql Command (Alternative)**

If you have psql available on Render:

```bash
psql $DATABASE_URL -f backend/migrations/fix_critical_columns.sql
```

---

## 🧪 TESTING AFTER DEPLOYMENT

### Test 1: Teams Functionality
1. Log in as any user
2. Navigate to Teams page
3. **Expected:** Page loads without errors
4. **Previous Error:** `column tm.team_role does not exist`

### Test 2: File Request Upload with Comments
1. Open a file request upload page (as editor)
2. Upload a file with comments
3. **Expected:** Upload succeeds and comments are saved
4. **Previous Error:** `column "comments" of relation "file_request_uploads" does not exist`

### Test 3: Folder Navigation
1. Go to Media Library
2. Click on any folder
3. **Expected:** Shows only files in that folder
4. **Previous Issue:** Showed all files regardless of folder

### Test 4: Slack Folder Sharing
1. Share a folder via Slack
2. Click "View Folder" button in Slack notification
3. **Expected:** Opens Media Library with that specific folder selected
4. **Previous Issue:** Opened dashboard root instead of folder

### Test 5: Direct Folder Links
1. Open URL: `https://your-frontend.onrender.com/media?folderId=SOME_FOLDER_ID`
2. **Expected:** Media Library opens with that folder selected
3. **New Feature:** Deep linking to specific folders

---

## 📊 VERIFICATION QUERIES

After running migration, you can verify the changes with these SQL queries:

```sql
-- Check team_role column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'team_members' AND column_name = 'team_role';

-- Check comments column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'file_request_uploads' AND column_name = 'comments';

-- Verify old 'role' column is gone
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'team_members' AND column_name = 'role';
-- Should return 0 rows
```

---

## 🔍 TROUBLESHOOTING

### If Migration Fails

1. **Check DATABASE_URL environment variable:**
   ```bash
   echo $DATABASE_URL
   ```

2. **Check if columns already exist:**
   ```bash
   node -e "
   const { Pool } = require('pg');
   const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
   pool.query(\`
     SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_name IN ('team_members', 'file_request_uploads')
     ORDER BY table_name, column_name
   \`).then(r => { console.log(r.rows); pool.end(); });
   "
   ```

3. **Manual rollback (if needed):**
   ```sql
   -- If you need to rollback (use with caution)
   BEGIN;
   ALTER TABLE team_members RENAME COLUMN team_role TO role;
   ALTER TABLE file_request_uploads DROP COLUMN comments;
   COMMIT;
   ```

### If Teams Page Still Shows Errors

1. Verify migration completed successfully
2. Restart backend service on Render
3. Check backend logs for any caching issues
4. Clear browser cache and refresh

### If Folder Navigation Still Shows All Files

1. Check browser console for JavaScript errors
2. Verify frontend deployment completed
3. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)

---

## 📝 FILES CHANGED

### Backend
- ✅ `backend/migrations/fix_critical_columns.sql` - SQL migration script
- ✅ `backend/migrations/run-critical-fix.js` - Node.js migration runner

### Frontend
- ✅ `frontend/src/pages/MediaLibrary.tsx` - Added URL parameter handling
- ✅ `frontend/src/components/ShareDialog.tsx` - Fixed folder URL generation

### Documentation
- ✅ `CRITICAL_FIXES_PLAN.md` - Comprehensive root cause analysis
- ✅ `DEPLOYMENT_INSTRUCTIONS.md` - This file

---

## 🎯 ROLLBACK PLAN (If Issues Occur)

### Code Rollback
```bash
git revert 1aadae5
git push origin main
```

### Database Rollback
```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.connect().then(async (client) => {
  await client.query('BEGIN');
  await client.query('ALTER TABLE team_members RENAME COLUMN team_role TO role');
  await client.query('ALTER TABLE file_request_uploads DROP COLUMN IF EXISTS comments');
  await client.query('COMMIT');
  console.log('✅ Rollback complete');
  client.release();
  pool.end();
}).catch(console.error);
"
```

---

## 📞 SUPPORT

If you encounter any issues during deployment:

1. Check backend logs on Render
2. Check browser console for frontend errors
3. Verify DATABASE_URL environment variable is set correctly
4. Ensure all environment variables are configured on Render

---

## ✅ DEPLOYMENT CHECKLIST

- [ ] Code deployed to Render (auto-deploy from GitHub)
- [ ] Database migration executed successfully
- [ ] Backend service restarted (if needed)
- [ ] Test 1: Teams page loads without errors
- [ ] Test 2: File request upload with comments works
- [ ] Test 3: Folder navigation shows correct files
- [ ] Test 4: Slack folder links work correctly
- [ ] Test 5: Direct folder URLs work (optional)
- [ ] All production errors resolved
- [ ] User acceptance testing completed

---

## 🎉 SUCCESS CRITERIA

All of these should be true after deployment:

✅ No more `column tm.team_role does not exist` errors
✅ No more `column "comments" of relation "file_request_uploads" does not exist` errors
✅ Clicking folders shows only files in that folder
✅ Slack "View Folder" links open correct folder
✅ Teams page fully functional
✅ File request uploads work with comments

---

**Deployment Date:** _______________
**Deployed By:** _______________
**Verification Status:** _______________
