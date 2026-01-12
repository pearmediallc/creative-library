# Production Deployment Tasks

## ✅ Completed Tasks

### 1. Editor File Request Visibility
- ✅ Modified `getAll()` and `getOne()` methods in fileRequestController.js
- ✅ Editors now see all requests assigned to them via file_request_editors table
- ✅ Fixed assigned editors query (removed non-existent columns)

### 2. Editor Analytics Access
- ✅ Added Analytics to editor navigation in Sidebar.tsx
- ✅ Removed requireAdmin middleware from /editor-performance route
- ✅ Auto-filters analytics to show only editor's own data

### 3. Bug Fixes
- ✅ Fixed assigned editors query (commit f59170d)
- ✅ Created hotfix migration for calculate_editor_load function
- ✅ Fixed missing query import in analyticsController

### 4. Slack Integration
- ✅ Updated environment variables with Slack OAuth credentials
- ✅ Added SLACK_BOT_TOKEN support for notifications
- ✅ Integrated file share notifications
- ✅ Created comprehensive documentation
- ✅ Pushed to GitHub (commit 0456bb7)

### 5. Share Functionality Verification
- ✅ Verified implementation works for all user roles
- ✅ Confirmed no role restrictions on shared-with-me endpoint
- ✅ Documented how permissions work

---

## ⏳ Pending Tasks

### Task 1: Run Migration on Production Database

**Why:** Fix the `calculate_editor_load` function that's causing "column fr.status does not exist" error

**How:** On your Render server shell, run:
```bash
cd ~/project/src/backend
node scripts/run-migration.js migrations/20260112_fix_calculate_editor_load_function.sql
```

**Expected Output:**
```
✅ Migration completed successfully!
```

### Task 2: Update Production Environment Variables

**Where:** Render Dashboard → Backend Service → Environment Variables

**Add these variables:**

```bash
# Slack OAuth and Bot Token
SLACK_CLIENT_ID=993338752987910276035245237
SLACK_CLIENT_SECRET=e4f30d5db3bc9c90c94f85c661067161
SLACK_SIGNING_SECRET=f773706037954063c007d646c150b688
SLACK_BOT_TOKEN=xoxb-9933387529879-10283091144020-li35TAK2VaMmniNZtx10

# Frontend URL (if not already set)
FRONTEND_URL=https://creative-library-frontend.onrender.com
```

**Steps:**
1. Go to https://dashboard.render.com
2. Select your backend service
3. Click "Environment" tab
4. Click "Add Environment Variable"
5. Add each variable above
6. Click "Save Changes"
7. **Important:** Service will auto-redeploy after saving

### Task 3: Wait for Render Deployment

**What happens:**
- Render detects new commits on GitHub
- Automatically deploys latest code
- Should take 3-5 minutes

**How to check:**
1. Go to Render Dashboard → Your service
2. Look for "Events" tab
3. Wait for "Deploy succeeded" message

---

## 🧪 Testing Checklist (After Deployment)

### Test 1: Media Buyer - File Request Creation
**Who:** Login as media buyer
**Steps:**
1. Go to File Requests
2. Click "Create Request"
3. Fill in details, assign to an editor
4. Click Submit

**Expected:** ✅ Request created successfully (no "column fr.status" error)

---

### Test 2: Editor - File Request Visibility
**Who:** Login as Ritu (editor)
**Steps:**
1. Go to File Requests page

**Expected:**
- ✅ All requests assigned to Ritu are visible
- ✅ Shows status, assigned date, etc.

---

### Test 3: Editor - Analytics Access
**Who:** Login as Ritu (editor)
**Steps:**
1. Check sidebar

**Expected:** ✅ Analytics link is visible

2. Click Analytics

**Expected:**
- ✅ Page loads without 500 error
- ✅ Shows only Ritu's own performance data

---

### Test 4: Share File with User
**Who:** Login as admin
**Steps:**
1. Go to Media Library
2. Select a file
3. Click Share button
4. Select "User" tab
5. Choose Ritu (editor)
6. Select "Can view" permission
7. Click Share

**Expected:**
- ✅ Permission granted successfully
- ✅ Ritu receives Slack DM notification (if she's connected to Slack)

---

### Test 5: Editor - Shared With Me
**Who:** Login as Ritu (editor)
**Steps:**
1. Click "Shared with me" in sidebar
2. Check file list

**Expected:**
- ✅ File shared in Test 4 appears
- ✅ Shows "view" permission badge
- ✅ Shows who shared it

---

### Test 6: Media Buyer - Shared With Me
**Who:** Login as media buyer
**Steps:**
1. Admin shares a file with this media buyer (same as Test 4)
2. Media buyer goes to "Shared with me"

**Expected:**
- ✅ Shared file appears
- ✅ Permissions displayed correctly

---

## 📊 Verification Queries

Run these in pgAdmin to verify data:

### Check if migration ran
```sql
-- This should NOT error
SELECT calculate_editor_load('00000000-0000-0000-0000-000000000000'::uuid);
```

### Check file permissions
```sql
-- See all active permissions
SELECT
  fp.resource_type,
  fp.grantee_type,
  u.name as grantee_name,
  fp.permission_type,
  mf.original_filename,
  fp.granted_at
FROM file_permissions fp
LEFT JOIN users u ON fp.grantee_type = 'user' AND fp.grantee_id = u.id
LEFT JOIN media_files mf ON fp.resource_type = 'file' AND fp.resource_id = mf.id
WHERE fp.expires_at IS NULL OR fp.expires_at > NOW()
ORDER BY fp.granted_at DESC
LIMIT 20;
```

### Check Slack notifications log
```sql
SELECT
  notification_type,
  u.name as user_name,
  status,
  message,
  created_at
FROM slack_notifications sn
JOIN users u ON sn.user_id = u.id
ORDER BY created_at DESC
LIMIT 10;
```

### Check editor file request assignments
```sql
SELECT
  fr.title,
  fr.request_type,
  e.name as editor_name,
  fre.status,
  fre.created_at as assigned_at
FROM file_request_editors fre
JOIN file_requests fr ON fre.request_id = fr.id
JOIN editors e ON fre.editor_id = e.id
WHERE fre.status IN ('pending', 'assigned', 'in_progress')
ORDER BY fre.created_at DESC;
```

---

## 🚨 Troubleshooting

### Issue: Migration fails with "database not found"
**Solution:** Make sure you're running the command on the Render server, not locally

### Issue: "SLACK_BOT_TOKEN not set" error in logs
**Solution:** Add SLACK_BOT_TOKEN to Render environment variables (Task 2)

### Issue: Files still not showing for editors
**Solution:**
1. Check if requests are actually assigned: Run "Check editor file request assignments" query above
2. Verify editor has active user account: `SELECT * FROM editors WHERE user_id = '<user_id>'`
3. Check if editor_id matches: Compare file_request_editors.editor_id with editors.id

### Issue: Analytics shows 500 error
**Solution:**
1. Check Render logs for actual error
2. Verify DATABASE_URL is set in environment
3. Ensure migration has run (query import was added)

### Issue: Shared files not appearing
**Solution:**
1. Check permissions table: Run "Check file permissions" query above
2. Verify grantee_id matches user's UUID
3. Check if permission has expired: `expires_at > NOW()`

---

## 📝 Summary

### What's Ready:
✅ All code changes pushed to GitHub
✅ Migration file created and ready to run
✅ Slack integration implemented
✅ Documentation complete

### What You Need to Do:
1. Run migration on production database (Task 1)
2. Add Slack environment variables in Render (Task 2)
3. Wait for deployment to complete (Task 3)
4. Test all features (Testing Checklist)

### Expected Timeline:
- Migration: 10 seconds
- Add env vars: 2 minutes
- Render deployment: 3-5 minutes
- Testing: 10 minutes

**Total: ~15-20 minutes**

---

## ✅ Final Checklist

- [ ] Run migration: `node scripts/run-migration.js migrations/20260112_fix_calculate_editor_load_function.sql`
- [ ] Add SLACK_CLIENT_ID to Render env vars
- [ ] Add SLACK_CLIENT_SECRET to Render env vars
- [ ] Add SLACK_SIGNING_SECRET to Render env vars
- [ ] Add SLACK_BOT_TOKEN to Render env vars
- [ ] Verify FRONTEND_URL is set correctly
- [ ] Wait for Render deployment to succeed
- [ ] Test: Media buyer creates file request
- [ ] Test: Editor sees assigned requests
- [ ] Test: Editor accesses analytics
- [ ] Test: Admin shares file with editor
- [ ] Test: Editor sees shared file
- [ ] Test: Slack notification sent (optional)

---

## 📞 Support

If you encounter any issues:

1. **Check Render Logs:**
   - Render Dashboard → Your Service → Logs tab
   - Look for errors or stack traces

2. **Check Database:**
   - Run verification queries in pgAdmin
   - Verify data exists and is correct

3. **Check GitHub:**
   - Verify latest commit is deployed: `0456bb7`
   - Check if all files were pushed

**Latest Commits:**
- `0456bb7` - Add Slack OAuth and notification integration
- `387ddf9` - Fix: Add missing database query import
- `933bba8` - Hotfix: Fix calculate_editor_load function
- `200611e` - Add editor file request visibility and analytics access
- `f59170d` - Fix assigned editors query
