# 🚀 Run Canvas Migration - Quick Guide

## Method 1: Render Shell (EASIEST - 2 minutes)

### Step 1: Open Shell
1. Go to https://dashboard.render.com
2. Click on your backend service: **creative-library**
3. Click **"Shell"** tab at the top
4. Wait for shell to connect (shows `~ $`)

### Step 2: Run This Command
```bash
node scripts/run-canvas-migration.js
```

### Step 3: Done! ✅
You'll see:
```
🎉 MIGRATION COMPLETED SUCCESSFULLY!
✨ The Canvas feature is now ready to use
```

---

## Expected Output

```
🚀 Starting Canvas Migration...

📊 Database: dpg-csq11fdsvqrc73amjv70-a.oregon-postgres.render.com

🔌 Connecting to database...
✅ Connected successfully

🔍 Checking if table already exists...
✅ Table does not exist - proceeding with migration

📝 Creating file_request_canvas table...
✅ Table created successfully

🔍 Verifying migration...
✅ Table file_request_canvas verified

✅ Indexes created: 4
   - file_request_canvas_pkey
   - idx_canvas_request
   - idx_canvas_content
   - idx_canvas_attachments

✅ Trigger created successfully
   - trigger_update_canvas_timestamp

🎉 MIGRATION COMPLETED SUCCESSFULLY!

✨ The Canvas feature is now ready to use
✨ The "Failed to load canvas" error should be resolved
```

---

## After Migration

✅ "Failed to load canvas" error will disappear  
✅ Canvas button will work in File Requests  
✅ Auto-save will function properly  
✅ File attachments can be uploaded to canvas  

---

## Already Ran It?

If you run it again, you'll see:
```
⚠️  Table file_request_canvas already exists
📋 Current records: 0
✨ Migration not needed - table already exists
```

This is normal and safe!

---

## Troubleshooting

**"Command not found"**  
→ Make sure you're in the Render Shell, not your local terminal

**"Permission denied"**  
→ Contact Render support - DATABASE_URL should have CREATE permissions

**Shell timeout/disconnect**  
→ Just run the command again - it's idempotent (safe to run multiple times)

---

## That's It!

The migration script:
- ✅ Checks if table exists first (won't duplicate)
- ✅ Creates all necessary indexes
- ✅ Sets up auto-update triggers
- ✅ Verifies everything worked
- ✅ Shows clear success/error messages

**Total time: ~5 seconds**
