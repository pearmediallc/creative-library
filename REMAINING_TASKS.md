# Remaining Frontend Tasks

## ✅ COMPLETED SO FAR (90% DONE):
1. ✅ All 4 database migrations created
2. ✅ Backend API fully updated for multi-platform/vertical
3. ✅ Backend reassignment with creative distribution
4. ✅ Folder model updated for nested structure
5. ✅ Status colors centralized
6. ✅ CreativeDistributionInput component created
7. ✅ UserFolderSection component created
8. ✅ CreateFileRequestModal updated with multi-select
9. ✅ ReassignFileRequestModal updated with distribution UI
10. ✅ SharedByMePage refactored with user folders

## 🔄 REMAINING TASKS (10%):

### 1. FileRequestDetailsModal Updates
**File**: `frontend/src/components/FileRequestDetailsModal.tsx`
**Changes Needed**:
```typescript
// Import centralized colors
import { getVerticalBadgeClasses, getStatusBadgeClasses } from '../constants/statusColors';

// Update interface to include arrays
interface FileRequestDetails {
  // Add these:
  platforms?: string[];
  verticals?: string[];
  assigned_editors?: Array<{
    num_creatives_assigned?: number;
    creatives_completed?: number;
  }>;
}

// Display multiple platforms (find where platform is shown)
{request.platforms && request.platforms.length > 0 && (
  <div className="flex flex-wrap gap-2">
    {request.platforms.map(platform => (
      <span key={platform} className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
        {platform}
      </span>
    ))}
  </div>
)}

// Display multiple verticals
{request.verticals && request.verticals.length > 0 && (
  <div className="flex flex-wrap gap-2">
    {request.verticals.map(vertical => (
      <span key={vertical} className={getVerticalBadgeClasses(vertical)}>
        {vertical}
      </span>
    ))}
  </div>
)}

// Display creative distribution in assigned editors section
{request.assigned_editors?.map(editor => (
  <div key={editor.id}>
    <p>{editor.name}</p>
    {editor.num_creatives_assigned > 0 && (
      <p className="text-xs text-gray-500">
        {editor.creatives_completed || 0}/{editor.num_creatives_assigned} creatives
      </p>
    )}
  </div>
))}
```

### 2. FileRequestsPage Updates
**File**: `frontend/src/pages/FileRequestsPage.tsx`
**Changes Needed**:
```typescript
// Import centralized colors
import { getVerticalBadgeClasses } from '../constants/statusColors';

// Update interface
interface FileRequest {
  platforms?: string[];
  verticals?: string[];
}

// In the table/card display, replace single badges with multiple:
{request.platforms && request.platforms.length > 0 && (
  <div className="flex flex-wrap gap-1">
    {request.platforms.map(p => (
      <span key={p} className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800">
        {p}
      </span>
    ))}
  </div>
)}

{request.verticals && request.verticals.length > 0 && (
  <div className="flex flex-wrap gap-1">
    {request.verticals.map(v => (
      <span key={v} className={getVerticalBadgeClasses(v)}>
        {v}
      </span>
    ))}
  </div>
)}

// Update filtering to check if arrays include the filter value:
if (selectedPlatform !== 'All' && !request.platforms?.includes(selectedPlatform)) {
  return false;
}
if (selectedVertical !== 'All' && !request.verticals?.includes(selectedVertical)) {
  return false;
}
```

### 3. Apply Centralized Status Colors
**Files to Update**:
- `FileRequestDetailsModal.tsx` - Replace hardcoded status badge colors
- `FileRequestsPage.tsx` - Replace getVerticalColor with imported version
- Any other components using status colors

**Find and Replace**:
```typescript
// Old
const badges = {
  open: { label: 'Open', color: 'bg-blue-100...' }
  ...
}

// New
import { getStatusBadgeClasses } from '../constants/statusColors';
<span className={getStatusBadgeClasses(status)}>{label}</span>
```

### 4. Update API Client Types
**File**: `frontend/src/lib/api.ts`
**Changes Needed**:
```typescript
// Add to fileRequestApi:
reassign: (id: string, data: {
  editor_distribution?: Array<{ editor_id: string; num_creatives: number }>;
  new_editor_ids?: string[];
  reason: string;
}) => axios.post(`/api/file-requests/${id}/reassign`, data),
```

### 5. Folder File Count Badges
**Any folder display components**:
```typescript
// When displaying folders, add badge:
{folder.file_count > 0 && (
  <span className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-700">
    {folder.file_count} files
  </span>
)}
```

## 🚀 FINAL STEP: Run Migrations

```bash
cd /Users/mac/Desktop/creative-library/backend
psql $DATABASE_URL -f migrations/20260217_01_multi_platform_vertical.sql
psql $DATABASE_URL -f migrations/20260217_02_creative_distribution.sql  
psql $DATABASE_URL -f migrations/20260217_03_workload_upload_triggers.sql
psql $DATABASE_URL -f migrations/20260217_04_folder_file_counts.sql
```

---

**Estimated Time to Complete Remaining**: 30-45 minutes
**Current Completion**: 90%
