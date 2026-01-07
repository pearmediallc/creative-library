# Advanced Upload Controls Integration Guide

This guide explains how to integrate the new advanced upload controls with pause/resume/cancel functionality.

## Components Created

1. `/src/hooks/useAdvancedUpload.ts` - Advanced upload hook with state management
2. `/src/components/UploadQueue.tsx` - Minimizable floating upload queue panel
3. `/src/components/BatchUploadModalEnhanced.tsx` - Enhanced upload modal using new hook
4. `/src/components/UploadProvider.tsx` - Context provider for global upload state

## Integration Steps

### Option 1: Using UploadProvider (Recommended)

Wrap your application (or specific pages) with the UploadProvider to enable global upload queue:

```tsx
// In src/App.tsx or src/pages/MediaLibrary.tsx
import { UploadProvider } from './components/UploadProvider';

function App() {
  return (
    <UploadProvider>
      {/* Your existing app content */}
      <YourComponent />
    </UploadProvider>
  );
}
```

Then use the enhanced upload modal:

```tsx
// In your component
import { BatchUploadModalEnhanced } from './components/BatchUploadModalEnhanced';
import { useUploadContext } from './components/UploadProvider';

function YourComponent() {
  const [showUploadModal, setShowUploadModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowUploadModal(true)}>Upload Files</button>

      {showUploadModal && (
        <BatchUploadModalEnhanced
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => fetchData()}
          editorId={editors[0]?.id || ''}
          currentFolderId={currentFolderId}
          editors={editors}
          buyers={buyers}
        />
      )}
    </>
  );
}
```

### Option 2: Direct Integration

If you want more control, use the hook directly:

```tsx
import { useAdvancedUpload } from './hooks/useAdvancedUpload';
import { UploadQueue } from './components/UploadQueue';

function YourComponent() {
  const uploadControls = useAdvancedUpload();

  return (
    <>
      {/* Your component content */}

      <UploadQueue
        tasks={uploadControls.tasks}
        isUploading={uploadControls.isUploading}
        stats={uploadControls.stats}
        onPause={uploadControls.pauseUpload}
        onPauseAll={uploadControls.pauseAll}
        onResume={uploadControls.resumeUpload}
        onResumeAll={uploadControls.resumeAll}
        onCancel={uploadControls.cancelUpload}
        onRetry={uploadControls.retryUpload}
        onRemove={uploadControls.removeTask}
        onClearCompleted={uploadControls.clearCompleted}
        onClearAll={uploadControls.clearAll}
      />
    </>
  );
}
```

## MediaLibrary.tsx Integration Example

Replace the existing BatchUploadModal import and usage:

```tsx
// Add these imports
import { UploadProvider } from '../components/UploadProvider';
import { BatchUploadModalEnhanced } from '../components/BatchUploadModalEnhanced';

// Wrap the DashboardLayout with UploadProvider
export function MediaLibraryPage() {
  // ... existing code ...

  return (
    <UploadProvider>
      <DashboardLayout>
        {/* ... existing content ... */}

        {/* Replace BatchUploadModal with BatchUploadModalEnhanced */}
        {showUploadModal && (
          <BatchUploadModalEnhanced
            isOpen={showUploadModal}
            onClose={() => setShowUploadModal(false)}
            onSuccess={fetchData}
            editorId={editors.length > 0 ? editors[0].id : ''}
            currentFolderId={currentFolderId}
            editors={editors}
            buyers={buyers}
          />
        )}
      </DashboardLayout>
    </UploadProvider>
  );
}
```

## Features

### Upload States
- **queued**: File is waiting to be uploaded
- **uploading**: File is currently being uploaded
- **paused**: Upload has been paused (can be resumed)
- **completed**: Upload finished successfully
- **failed**: Upload failed (can be retried)
- **cancelled**: Upload was cancelled by user

### Upload Queue Features
- **Minimizable panel**: Click minimize to show compact badge
- **Individual controls**: Pause, resume, cancel each upload
- **Bulk controls**: Pause all, resume all, clear completed
- **Progress tracking**: Real-time progress, speed, and ETA
- **Thumbnails**: Image previews for uploaded files
- **Persistence**: Upload state persists across page refreshes (localStorage)
- **Concurrent uploads**: Max 3 simultaneous uploads
- **Dark mode support**: Automatically adapts to theme

### Upload Methods

```typescript
// Add files to queue
const tasks = await addFiles([file1, file2, file3]);

// Start uploading with options
await startUpload({
  editorId: 'editor-123',
  tags: ['campaign', 'product'],
  description: 'Product images',
  folderId: 'folder-456',
  organizeByDate: false,
  assignedBuyerId: 'buyer-789',
  removeMetadata: false,
  addMetadata: true,
});

// Control individual uploads
pauseUpload('task-id');
resumeUpload('task-id');
cancelUpload('task-id');
retryUpload('task-id');
removeTask('task-id');

// Bulk controls
pauseAll();
resumeAll();
clearCompleted();
clearAll();
```

## Backend Support (Future Enhancement)

For true resumable uploads (not currently implemented), the backend would need:

1. **Chunked upload support**: Accept file chunks
2. **Upload session tracking**: Track upload progress by session ID
3. **Range header support**: Accept `Content-Range` headers
4. **Partial file storage**: Store incomplete uploads temporarily

Example backend changes needed:

```typescript
// POST /api/media/upload/init - Initialize upload session
// POST /api/media/upload/chunk - Upload chunk with Range header
// POST /api/media/upload/complete - Finalize upload
// GET /api/media/upload/status/:sessionId - Check upload status
```

## Current Implementation Notes

- **Pause**: Aborts the current XHR request and stores progress
- **Resume**: Restarts the upload from the beginning (not true resume)
- **Cancel**: Aborts the request and marks as cancelled
- **Persistence**: Upload queue state saved to localStorage

For production use with large files, implement true resumable uploads on the backend.

## Styling

The upload queue uses Tailwind CSS and supports dark mode. Key classes:

- Floating panel: `fixed bottom-4 right-4 z-50`
- Width: `420px`
- Max height: `600px`
- Shadow: `shadow-2xl`

Customize by modifying the UploadQueue component.

## Troubleshooting

### Queue not showing
- Ensure UploadProvider wraps your component
- Check that files have been added to the queue
- Verify upload queue isn't minimized

### Uploads not persisting
- Check browser localStorage is enabled
- Verify STORAGE_KEY in useAdvancedUpload.ts is unique

### Progress not updating
- Ensure XHR upload.progress event is firing
- Check network tab for upload progress
- Verify file size > 0

## Example Usage

See `/src/components/BatchUploadModalEnhanced.tsx` for a complete example of integration with a modal dialog.
