# Upload Controls - Quick Start Guide

## What Was Implemented

Advanced upload controls with **pause**, **resume**, **cancel** functionality, including:

- **Upload Queue Management**: Track multiple uploads with individual controls
- **Persistent State**: Uploads survive page refreshes (localStorage)
- **Concurrent Uploads**: Max 3 simultaneous uploads
- **Real-time Progress**: Live progress bars, speed, and ETA
- **Minimizable UI**: Floating panel that can minimize to a badge
- **Dark Mode Support**: Automatic theme adaptation

## Files Created

### Core Components (Ready to Use)
```
frontend/src/
├── hooks/
│   └── useAdvancedUpload.ts          ← Upload state management
├── components/
│   ├── UploadQueue.tsx               ← Floating upload queue UI
│   ├── UploadProvider.tsx            ← Context provider wrapper
│   └── BatchUploadModalEnhanced.tsx  ← Enhanced upload modal
```

### Documentation
```
frontend/
├── UPLOAD_INTEGRATION.md             ← Detailed integration guide
└── INTEGRATION_EXAMPLE.tsx           ← Copy-paste example

Root/
├── UPLOAD_CONTROLS_SUMMARY.md        ← Complete feature summary
└── UPLOAD_ARCHITECTURE.md            ← System architecture
```

## Integration in 3 Steps

### Step 1: Add Imports to MediaLibrary.tsx

```typescript
import { UploadProvider } from '../components/UploadProvider';
import { BatchUploadModalEnhanced } from '../components/BatchUploadModalEnhanced';
```

### Step 2: Wrap Component with Provider

```typescript
export function MediaLibraryPage() {
  // ... existing code ...

  return (
    <UploadProvider>  {/* ← Add this wrapper */}
      <DashboardLayout>
        {/* ... existing content ... */}
      </DashboardLayout>
    </UploadProvider>  {/* ← Close wrapper */}
  );
}
```

### Step 3: Replace Upload Modal

Find this code:
```typescript
{showUploadModal && (
  <BatchUploadModal
    // ...props
  />
)}
```

Replace with:
```typescript
{showUploadModal && (
  <BatchUploadModalEnhanced  {/* ← Change component name */}
    isOpen={showUploadModal}
    onClose={() => setShowUploadModal(false)}
    onSuccess={fetchData}
    editorId={editors.length > 0 ? editors[0].id : ''}
    currentFolderId={currentFolderId}
    editors={editors}
    buyers={buyers}
  />
)}
```

**That's it!** The upload queue will automatically appear when files are being uploaded.

## How It Works

### Upload States

Each file can be in one of these states:

- **queued** 🔵 - Waiting to upload
- **uploading** ⏳ - Currently uploading
- **paused** ⏸️ - Upload paused (can resume)
- **completed** ✅ - Upload successful
- **failed** ❌ - Upload failed (can retry)
- **cancelled** 🚫 - User cancelled

### Upload Queue UI

The upload queue appears as a floating panel in the bottom-right corner:

```
┌─────────────────────────┐
│ Upload Queue    [-][×]  │ ← Header with minimize/close
├─────────────────────────┤
│ Progress: 3/5 files     │ ← Overall progress
│ ████████░░░░░ 60%       │
│ 2.5 MB/s • 30s left     │ ← Speed and ETA
├─────────────────────────┤
│ [⏸][⏯][🗑] Pause/Resume │ ← Bulk controls
├─────────────────────────┤
│ 📷 image1.jpg           │ ← Individual files
│    ████████████ 100% ✅  │
│                         │
│ 📷 image2.jpg           │
│    ██████░░░░░░ 45% ⏳   │
│    [⏸] 2.1 MB/s         │ ← Individual controls
│                         │
│ 📷 image3.jpg           │
│    Queued 🔵            │
└─────────────────────────┘
```

**Features:**
- Click **[-]** to minimize to badge
- Click header to collapse/expand
- Individual pause/resume/cancel per file
- Bulk operations for all files
- Auto-scrolling task list

### Minimized Badge

When minimized, shows compact status:
```
┌──────────────┐
│ ⏳ 3 uploading│  ← Click to expand
└──────────────┘
```

## User Experience

### Uploading Files

1. **User clicks "Upload Files"** → Modal opens
2. **User selects files** → Files added to queue (queued state)
3. **User configures options** → Set editor, tags, etc.
4. **User clicks "Upload"** → Uploads start
   - Modal closes (uploads continue in background)
   - Upload queue appears bottom-right
   - Files upload 3 at a time

### Managing Uploads

- **Pause upload**: Click ⏸️ on individual file
- **Resume upload**: Click ⏯️ on paused file
- **Cancel upload**: Click ❌ on active file
- **Retry failed**: Click 🔄 on failed file
- **Remove from queue**: Click 🗑️ on completed/cancelled

### Bulk Operations

- **Pause All**: Pauses all active uploads
- **Resume All**: Resumes all paused uploads
- **Clear Completed**: Removes successful uploads from list

### Persistence

Upload state is saved to browser's localStorage:
- **Page refresh**: Queue restored, paused uploads remain paused
- **Browser restart**: Queue state persists
- **Navigate away**: Uploads continue (if using app-level provider)

## Configuration

### Concurrent Upload Limit

Default: 3 simultaneous uploads

To change, edit `useAdvancedUpload.ts`:
```typescript
const MAX_CONCURRENT_UPLOADS = 3; // Change this number
```

### Storage Key

Default: `upload_queue_state`

To change, edit `useAdvancedUpload.ts`:
```typescript
const STORAGE_KEY = 'upload_queue_state'; // Change key name
```

## Limitations & Future

### Current Limitations

1. **Pseudo-Resume**: "Resume" restarts upload from beginning
   - Pause = abort XHR + save progress
   - Resume = start fresh upload
   - Not true chunked resume

2. **Single Request**: Each file uploaded in one request
   - Large files (>100MB) not recommended
   - No chunk splitting

### Future Enhancements

For true resumable uploads, backend needs:

```typescript
// Upload session endpoints
POST /api/media/upload/init      // Start session
POST /api/media/upload/chunk     // Upload chunk
POST /api/media/upload/complete  // Finalize
GET  /api/media/upload/status    // Check progress
```

With backend support:
- ✅ True pause/resume from exact byte position
- ✅ Upload files of any size (chunked)
- ✅ Network recovery (resume after disconnect)
- ✅ Cross-device resume (same upload ID)

## Troubleshooting

### Queue Not Showing

**Problem**: Upload queue doesn't appear
**Solution**:
- Check UploadProvider wraps your component
- Verify files were added (check browser console)
- Look for minimized badge in bottom-right

### Uploads Not Persisting

**Problem**: Queue clears on page refresh
**Solution**:
- Check browser localStorage is enabled
- Open DevTools → Application → Local Storage
- Look for key `upload_queue_state`

### Progress Not Updating

**Problem**: Progress bar stuck
**Solution**:
- Check network tab for upload progress
- Verify file size > 0
- Check XHR progress events in console

### TypeScript Errors

**Problem**: TS errors about useUploadContext
**Solution**:
- Ensure component is wrapped in `<UploadProvider>`
- Import from correct path: `'./components/UploadProvider'`

## Advanced Usage

### Using Context Directly

```typescript
import { useUploadContext } from './components/UploadProvider';

function MyComponent() {
  const {
    tasks,
    stats,
    addFiles,
    startUpload,
    pauseUpload,
    resumeUpload,
  } = useUploadContext();

  // Access upload state and methods
  console.log(`${stats.uploading} files uploading`);

  return <div>...</div>;
}
```

### Global Upload Queue

Wrap entire app instead of single page:

```typescript
// App.tsx
import { UploadProvider } from './components/UploadProvider';

function App() {
  return (
    <UploadProvider>
      {/* Upload queue visible across all pages */}
      <Router>
        <Routes>...</Routes>
      </Router>
    </UploadProvider>
  );
}
```

Benefits:
- Uploads continue when navigating pages
- Unified upload queue across entire app
- Upload from any page

## Testing Checklist

Before using in production, test:

- [ ] Upload single file
- [ ] Upload multiple files (10+)
- [ ] Pause individual upload
- [ ] Resume paused upload
- [ ] Cancel active upload
- [ ] Retry failed upload
- [ ] Pause all uploads
- [ ] Resume all uploads
- [ ] Clear completed uploads
- [ ] Minimize/expand queue
- [ ] Page refresh during upload
- [ ] Large file upload (>50MB)
- [ ] Network interruption
- [ ] Dark mode appearance
- [ ] Mobile responsiveness

## Support

**Documentation**:
- Full guide: `/frontend/UPLOAD_INTEGRATION.md`
- Architecture: `/UPLOAD_ARCHITECTURE.md`
- Summary: `/UPLOAD_CONTROLS_SUMMARY.md`

**Example Code**:
- Integration: `/frontend/INTEGRATION_EXAMPLE.tsx`

**Source Files**:
- Hook: `/frontend/src/hooks/useAdvancedUpload.ts`
- UI: `/frontend/src/components/UploadQueue.tsx`
- Provider: `/frontend/src/components/UploadProvider.tsx`
- Modal: `/frontend/src/components/BatchUploadModalEnhanced.tsx`

## Quick Reference

### Import Statements
```typescript
import { UploadProvider } from '../components/UploadProvider';
import { BatchUploadModalEnhanced } from '../components/BatchUploadModalEnhanced';
import { useUploadContext } from '../components/UploadProvider';
```

### Wrapper Pattern
```typescript
<UploadProvider>
  <YourApp />
</UploadProvider>
```

### Using Context
```typescript
const { tasks, stats, addFiles, startUpload } = useUploadContext();
```

### Upload Methods
```typescript
await addFiles([file1, file2]);
await startUpload({ editorId, tags, ... });
pauseUpload(taskId);
resumeUpload(taskId);
cancelUpload(taskId);
retryUpload(taskId);
```

---

**Ready to use!** Follow the 3-step integration and start uploading with advanced controls.
