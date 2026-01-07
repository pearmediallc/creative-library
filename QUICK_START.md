# Quick Start - Deploy All Features in 5 Minutes

This is a quick reference for deploying all 10 new features. For detailed documentation, see [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md).

## Prerequisites

- PostgreSQL database access
- Git repository already pulled (commit: b07d045)

## Step 1: Backup Database (30 seconds)

```bash
pg_dump -U your_username -d creative_library > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Step 2: Run Migration (1 minute)

```bash
cd /Users/mac/Desktop/creative-library/backend
psql -U your_username -d creative_library -f migrations/CONSOLIDATED_20240113_all_new_features.sql
```

Expected output: Multiple "CREATE TABLE" and "CREATE INDEX" messages.

## Step 3: Verify Migration (30 seconds)

```bash
psql -U your_username -d creative_library -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('file_comments', 'comment_reactions', 'file_requests',
                   'file_request_uploads', 'saved_searches', 'public_link_access_log')
ORDER BY table_name;"
```

Expected: 6 rows returned.

## Step 4: Install Frontend Dependencies (1 minute)

```bash
cd /Users/mac/Desktop/creative-library/frontend
npm install pdfjs-dist@3.11.174
```

## Step 5: Start Backend (30 seconds)

```bash
cd /Users/mac/Desktop/creative-library/backend
npm run dev
```

Look for: `✅ Database connected` and `🚀 CREATIVE ASSET LIBRARY - SERVER RUNNING`

## Step 6: Start Frontend (30 seconds)

Open new terminal:

```bash
cd /Users/mac/Desktop/creative-library/frontend
npm start
```

Look for: `Compiled successfully!` and browser opening to http://localhost:3000

## Step 7: Quick Test (1 minute)

1. **Login** to your application
2. **Right-click any file** → Should see new menu items: "Comments", "Activity", "Properties"
3. **Click "File Requests"** in sidebar → Should load page
4. **Click "Collections"** in sidebar → Should load page
5. **Right-click file → Share → "Get link" tab** → Should generate public link

## Done! 🎉

All 10 features are now live:

1. ✅ Comments System
2. ✅ Activity Feed
3. ✅ Upload Folder
4. ✅ Advanced Upload Controls
5. ✅ PDF Preview
6. ✅ File Requests
7. ✅ Smart Collections
8. ✅ Public Link Sharing
9. ✅ Breadcrumb Dropdown
10. ✅ Properties Panel

## Troubleshooting

### Migration Error: "relation already exists"
This is normal if you've run it before. The migration is idempotent.

### Backend Won't Start
- Check PostgreSQL is running
- Verify .env file has correct DATABASE_URL

### Frontend Won't Compile
- Run `npm install` again
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### New Features Don't Appear
- Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
- Clear browser cache
- Check browser console for errors

## Full Documentation

For comprehensive guides, see:
- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - Complete deployment guide
- [DEPLOYMENT_COMPLETE.md](DEPLOYMENT_COMPLETE.md) - Full feature summary

## Support

Check logs:
- Backend: Terminal where `npm run dev` is running
- Frontend: Browser DevTools Console (F12)
- Database: `tail -f /var/log/postgresql/postgresql.log` (location varies)
