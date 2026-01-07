# Upload Controls Architecture

## Component Hierarchy

```
App / MediaLibraryPage
│
├── UploadProvider (Context Provider)
│   │
│   ├── useAdvancedUpload() hook
│   │   ├── Upload State Management
│   │   ├── Queue Processing
│   │   ├── XHR Handlers
│   │   └── localStorage Persistence
│   │
│   ├── Upload Context
│   │   └── Provides upload methods to children
│   │
│   └── UploadQueue Component (Auto-rendered)
│       ├── Minimized Badge
│       ├── Collapsed Header
│       └── Expanded Queue List
│           ├── Task Item 1 (with controls)
│           ├── Task Item 2 (with controls)
│           └── Task Item N (with controls)
│
└── BatchUploadModalEnhanced
    ├── File Selection (drag & drop)
    ├── Upload Configuration
    └── Triggers: addFiles() & startUpload()
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │   BatchUploadModalEnhanced           │
        │   - Select files                     │
        │   - Configure options                │
        │   - Click "Upload"                   │
        └──────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │   useUploadContext()                 │
        │   - addFiles(files)                  │
        │   - startUpload(options)             │
        └──────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │   useAdvancedUpload()                │
        │   - Create UploadTasks               │
        │   - Queue Management                 │
        │   - Process Queue                    │
        └──────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │   Upload Execution                   │
        │   - Max 3 concurrent                 │
        │   - XMLHttpRequest                   │
        │   - Progress tracking                │
        └──────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │   State Updates                      │
        │   - Progress updates                 │
        │   - Status changes                   │
        │   - localStorage sync                │
        └──────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │   UploadQueue UI                     │
        │   - Renders task list                │
        │   - Shows progress                   │
        │   - Displays controls                │
        └──────────────────────────────────────┘
```

## State Machine

```
Upload Task State Transitions:

        ┌─────────┐
        │ queued  │ ◄────────┐
        └─────────┘          │
             │               │
             │ startUpload() │
             ▼               │
      ┌────────────┐         │
      │ uploading  │         │
      └────────────┘         │
           │  │  │           │
           │  │  └─────────┐ │
           │  │            │ │
    pause()│  │cancel()    │ │ retry()
           │  │            │ │
           ▼  ▼            ▼ │
      ┌────────┐      ┌─────────┐
      │ paused │      │cancelled│
      └────────┘      └─────────┘
           │               │
    resume()│               │
           │                │
           └────────────────┘
                │
                │
                ▼
         ┌───────────┐
         │ completed │
         └───────────┘
                │
                │ error
                ▼
         ┌──────────┐
         │  failed  │
         └──────────┘
                │
         retry()│
                │
                └─────────────► queued
```

## Upload Queue Processing

```
┌─────────────────────────────────────────────────────────┐
│                    processQueue()                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │ Get queued tasks      │
                └───────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │ For each queued task:                │
        │                                      │
        │  1. Wait for available slot          │
        │     (max 3 concurrent)               │
        │                                      │
        │  2. Mark slot as occupied            │
        │     activeUploadsRef.add(taskId)     │
        │                                      │
        │  3. Start upload                     │
        │     uploadSingleTask(task, options)  │
        │                                      │
        │  4. On complete/error:               │
        │     - Update task status             │
        │     - Release slot                   │
        │     activeUploadsRef.delete(taskId)  │
        └──────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │ Wait for all active uploads          │
        │ while (activeUploads.size > 0)       │
        └──────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │ Complete                             │
        │ - Set isUploading = false            │
        │ - Clear uploadOptionsRef             │
        └──────────────────────────────────────┘
```

## Upload Task Structure

```typescript
interface UploadTask {
  id: string;              // Unique identifier
  file: File;              // File to upload
  status: UploadStatus;    // Current state
  progress: number;        // 0-100
  uploadedBytes: number;   // Bytes uploaded
  totalBytes: number;      // Total file size
  speed?: number;          // Bytes per second
  error?: string;          // Error message
  xhr?: XMLHttpRequest;    // Active XHR object
  startTime?: number;      // Upload start timestamp
  pausedAt?: number;       // Pause timestamp
  thumbnail?: string;      // Base64 image preview
}
```

## Concurrent Upload Management

```
Active Uploads Tracking:

activeUploadsRef = Set<string>  // Set of active task IDs

Max Concurrent = 3

Example Timeline:

Time  │ Action           │ Active Set      │ Queued
─────┼──────────────────┼─────────────────┼────────
0s    │ Start task-1     │ {task-1}        │ [2,3,4,5]
0.1s  │ Start task-2     │ {task-1, task-2}│ [3,4,5]
0.2s  │ Start task-3     │ {1,2,3}         │ [4,5]
0.3s  │ Wait (max=3)     │ {1,2,3}         │ [4,5]
5s    │ task-1 complete  │ {2,3}           │ [4,5]
5.1s  │ Start task-4     │ {2,3,4}         │ [5]
10s   │ task-2 complete  │ {3,4}           │ [5]
10.1s │ Start task-5     │ {3,4,5}         │ []
15s   │ task-3 complete  │ {4,5}           │ []
20s   │ task-4 complete  │ {5}             │ []
25s   │ task-5 complete  │ {}              │ []
      │ All done!        │                 │
```

## XHR Event Flow

```
uploadSingleTask(task, options)
│
├─► Create XMLHttpRequest
│
├─► Setup FormData
│   - Append file
│   - Append upload options
│
├─► Register Event Handlers
│   │
│   ├─► upload.progress
│   │   └─► Update: progress, speed, uploadedBytes
│   │
│   ├─► load (success)
│   │   └─► Update: status='completed', progress=100
│   │
│   ├─► error
│   │   └─► Update: status='failed', error message
│   │
│   └─► abort
│       └─► Cleanup: remove from activeUploads
│
├─► Store XHR in task
│   (enables pause/cancel)
│
├─► Open & Send Request
│   POST /api/media/upload
│   Authorization: Bearer token
│
└─► Promise resolves/rejects based on events
```

## localStorage Persistence

```
Storage Key: 'upload_queue_state'

Saved Data:
[
  {
    id: 'task-123',
    file: File (metadata only, not actual file),
    status: 'queued',
    progress: 45,
    uploadedBytes: 1500000,
    totalBytes: 3000000,
    thumbnail: 'data:image/jpeg;base64,...'
    // xhr is NOT saved (can't serialize)
  },
  // ... more tasks
]

On Page Load:
1. Read from localStorage
2. Parse JSON
3. Reset 'uploading' → 'queued'
4. Remove XHR references
5. Populate state

On State Change:
1. Filter out XHR objects
2. Serialize to JSON
3. Save to localStorage
```

## Component Communication

```
┌──────────────────────────────────────────────────────┐
│                  UploadProvider                      │
│  (React Context)                                     │
│                                                      │
│  Provides:                                           │
│  - tasks: UploadTask[]                               │
│  - isUploading: boolean                              │
│  - stats: Stats                                      │
│  - addFiles()                                        │
│  - startUpload()                                     │
│  - pauseUpload()                                     │
│  - resumeUpload()                                    │
│  - cancelUpload()                                    │
│  - retryUpload()                                     │
│  - etc.                                              │
└──────────────────────────────────────────────────────┘
                    │                │
                    │                │
        ┌───────────┴──┐   ┌─────────┴────────┐
        │              │   │                  │
        ▼              │   ▼                  │
┌─────────────┐        │ ┌──────────────┐     │
│BatchUpload  │        │ │UploadQueue   │     │
│ModalEnhanced│        │ │              │     │
│             │        │ │              │     │
│useUpload    │        │ │useUpload     │     │
│Context()    │        │ │Context()     │     │
└─────────────┘        │ └──────────────┘     │
                       │                      │
                       │                      │
                    Any other component       │
                    can use context           │
                       │                      │
                       ▼                      │
                ┌─────────────────┐           │
                │  Custom         │           │
                │  Component      │           │
                │                 │           │
                │  useUpload      │           │
                │  Context()      │           │
                └─────────────────┘           │
                                              │
                    All share the same        │
                    upload state! ────────────┘
```

## File Upload Options Flow

```
BatchUploadModalEnhanced
│
├─► User configures options:
│   - editorId (required)
│   - tags (optional)
│   - description (optional)
│   - folderId (optional)
│   - organizeByDate (boolean)
│   - assignedBuyerId (optional)
│   - removeMetadata (boolean)
│   - addMetadata (boolean)
│
└─► Calls startUpload(options)
    │
    └─► Options stored in uploadOptionsRef
        │
        └─► Applied to each file upload:
            │
            └─► FormData:
                - file
                - editor_id
                - tags (JSON)
                - description
                - folder_id
                - organize_by_date
                - assigned_buyer_id
                - remove_metadata
                - add_metadata
```

## UI State Diagram

```
UploadQueue UI States:

┌─────────────────┐
│   Minimized     │
│   (Badge)       │
│                 │
│  [⭯ 3 uploading]│
│                 │
└─────────────────┘
        │ click
        ▼
┌─────────────────┐
│   Expanded      │
│  ┌───────────┐  │
│  │ Header    │  │ ◄── Click collapse
│  ├───────────┤  │
│  │ Progress  │  │
│  ├───────────┤  │
│  │ Controls  │  │
│  ├───────────┤  │
│  │ Task List │  │
│  │  - Task 1 │  │
│  │  - Task 2 │  │
│  │  - Task 3 │  │
│  └───────────┘  │
└─────────────────┘
        │ click collapse
        ▼
┌─────────────────┐
│   Collapsed     │
│  ┌───────────┐  │
│  │ Header    │  │
│  └───────────┘  │
│                 │
└─────────────────┘
```

## Integration Points

```
Application Entry
│
├─► Option 1: Wrap specific page
│   MediaLibraryPage
│   └─► UploadProvider
│       └─► DashboardLayout
│           └─► Content
│
└─► Option 2: Wrap entire app
    App.tsx
    └─► UploadProvider
        └─► Router
            └─► Routes
                ├─► MediaLibrary
                ├─► Analytics
                └─► Settings
```

This architecture provides:
- **Separation of concerns**: Hook (logic) vs Components (UI)
- **Reusability**: Context makes upload state available anywhere
- **Persistence**: State survives page refreshes
- **Scalability**: Easy to add new upload sources
- **Control**: Fine-grained pause/resume/cancel operations
