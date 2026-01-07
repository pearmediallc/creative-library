# 🚀 Folder System - Quick Start Guide

## ✅ System Status

**Backend**: ✅ Running on [http://localhost:3001](http://localhost:3001)
**Frontend**: ✅ Running on [http://localhost:3000](http://localhost:3000)
**Database**: ✅ Connected (Local PostgreSQL)

---

## 🎯 Quick Test Scenarios

### 1. Create Your First Folder

1. Open [http://localhost:3000](http://localhost:3000)
2. Login with your credentials
3. Navigate to **Media Library**
4. You'll see the new **folder tree sidebar** on the left
5. Click the **"+"** button at the top of the sidebar
6. Enter folder name: **"Campaign Assets"**
7. Choose a color
8. Click **"Create Folder"**

**Result**: Folder appears in sidebar!

### 2. Upload with Date Organization

1. In Media Library, click **"Upload File"**
2. Select a file
3. Choose an editor
4. ✅ **Check "Organize by date"**
5. Click **"Upload"**

**Result**: File automatically goes to `jan2024/07-jan/` folder!

**S3 Path Created**: `editor-name/jan2024/07-jan/images/file.jpg`

### 3. Create Nested Folders

1. Right-click on **"Campaign Assets"** folder in sidebar
2. Select **"Create Subfolder"**
3. Enter name: **"Q1 2024"**
4. Click **"Create Folder"**

**Result**: Nested folder **Campaign Assets > Q1 2024** created!

### 4. Navigate Folders

1. Click on **"jan2024"** folder in sidebar
2. Main view shows **contents** of jan2024
3. See **breadcrumb** at top: **Home > jan2024**
4. Click **"Home"** to go back

**Result**: Easy folder navigation!

### 5. Upload to Specific Folder

1. Navigate into **"Campaign Assets/Q1 2024"** folder
2. Click **"Upload File"**
3. Upload file (notice: "Uploading to current folder" message)
4. File goes directly to Q1 2024 folder

**S3 Path**: `editor-name/Campaign Assets/Q1 2024/images/file.jpg`

### 6. Drag-and-Drop Files

1. Go to **"All Files"** view
2. Find a file you want to move
3. **Drag the file** from main view
4. **Drop it** onto a folder in the left sidebar
5. File moves instantly!

**Result**: File folder_id updated, no re-upload needed!

### 7. Rename Folder

1. Right-click on any folder
2. Select **"Rename"**
3. Enter new name
4. Click **OK**

**Result**: Folder renamed, S3 paths updated automatically!

### 8. View Folder Properties

1. Right-click on folder
2. Select **"Properties"**
3. See folder details

---

## 📁 Example Folder Structures You Can Create

### Option 1: Date-Based (Automatic)
```
📁 All Files
  └─ 📁 jan2024
      ├─ 📁 01-jan
      ├─ 📁 07-jan
      └─ 📁 15-jan
  └─ 📁 feb2024
      ├─ 📁 01-feb
      └─ 📁 14-feb
```

### Option 2: Campaign-Based (Manual)
```
📁 All Files
  └─ 📁 Campaign Assets
      ├─ 📁 Q1 2024
      │   ├─ 📁 Product Launch
      │   └─ 📁 Brand Awareness
      └─ 📁 Q2 2024
          └─ 📁 Summer Sale
```

### Option 3: Mixed Approach
```
📁 All Files
  └─ 📁 Campaign Assets
      └─ 📁 Summer 2024
          └─ 📁 jun2024
              ├─ 📁 01-jun
              └─ 📁 15-jun
```

---

## 🎨 UI Features Overview

### Left Sidebar - Folder Tree
- **Expandable/collapsible** folders (click arrow icon)
- **"All Files"** shows root level files
- **Right-click** for context menu
- **Click folder** to navigate into it
- **"+" button** to create new folder

### Main View - Folders & Files
- **FOLDERS shown FIRST** (per your requirement!)
- Files shown below folders
- Click folder card to navigate
- Drag files to folders
- Upload button respects current folder

### Top Bar - Breadcrumb
- Shows: **Home > folder > subfolder**
- Click any level to navigate back
- Auto-updates when navigating

### Context Menu (Right-Click)
- **Rename** - Change folder name
- **Delete** - Remove folder
- **Create Subfolder** - Add nested folder
- **Properties** - View folder info

---

## 🔧 Advanced Features

### Bulk File Move
1. Enable **"Bulk Edit"** mode
2. Select multiple files (checkboxes appear)
3. Drag all selected files to a folder
4. All files move at once!

### Folder Colors
When creating folders, choose from 6 colors:
- 🔵 Blue (default)
- 🟢 Green
- 🟡 Yellow
- 🔴 Red
- 🟣 Purple
- 🔴 Pink

### Upload Options

**When uploading from root:**
- ☑️ **Organize by date** - Auto-creates jan2024/07-jan/
- Editor selection
- Tags
- Description
- Metadata options

**When uploading from within a folder:**
- File goes to current folder automatically
- All other options available

---

## 📊 Backend API Endpoints (For Testing)

### Folder Endpoints
```bash
# Get folder tree
GET http://localhost:3001/api/folders/tree

# Create folder
POST http://localhost:3001/api/folders
{
  "name": "My Folder",
  "parent_folder_id": null,
  "description": "Optional"
}

# Get folder contents
GET http://localhost:3001/api/folders/{folder_id}/contents

# Get breadcrumb
GET http://localhost:3001/api/folders/{folder_id}/breadcrumb

# Move files
POST http://localhost:3001/api/folders/move-files
{
  "file_ids": ["uuid1", "uuid2"],
  "target_folder_id": "folder-uuid"
}

# Create date folder
POST http://localhost:3001/api/folders/date-folder
{
  "date": "2024-01-15",
  "parent_folder_id": null
}
```

### Upload with Folder Options
```bash
POST http://localhost:3001/api/media/upload
Content-Type: multipart/form-data

file: [binary]
editor_id: "editor-uuid"
folder_id: "folder-uuid"        # Optional - target folder
organize_by_date: "true"        # Optional - auto date folders
assigned_buyer_id: "buyer-uuid" # Optional - buyer assignment
tags: ["tag1", "tag2"]
description: "Description"
```

---

## 🔍 Troubleshooting

### Folder Not Appearing
- Check browser console for errors
- Refresh the page
- Verify folder was created in database

### Upload to Wrong Folder
- Check current folder in breadcrumb
- Use "Organize by date" checkbox if desired
- Navigate to correct folder before uploading

### Drag-and-Drop Not Working
- Ensure files are draggable (cursor changes)
- Drop onto folders in sidebar or folder cards
- Check console for errors

### S3 Path Issues
- Files in folders: `editor-name/folder-path/images/file.jpg`
- Files without folders: `editor-name/images/file.jpg`
- Check database `folders.s3_path` column

---

## 📸 What You Should See

### Media Library Layout
```
┌─────────────────┬────────────────────────────────┐
│ 📁 Folders      │  📍 Home > Campaign Assets     │
│                 │  ────────────────────────────  │
│ [+] New Folder  │  🔵 Folders                    │
│                 │  ┌─────────┐  ┌─────────┐      │
│ > All Files     │  │📁 Q1    │  │📁 Q2    │      │
│ > 📁 jan2024    │  │3 files  │  │5 files  │      │
│   > 📁 01-jan   │  └─────────┘  └─────────┘      │
│   > 📁 07-jan   │                                │
│ > 📁 Campaign   │  📄 Files                      │
│   > 📁 Q1       │  ┌─────────┐  ┌─────────┐      │
│   > 📁 Q2       │  │🖼️ img1  │  │🎬 vid1  │      │
│                 │  │2.3 MB   │  │12.1 MB  │      │
└─────────────────┴────────────────────────────────┘
```

---

## ✅ Checklist - Verify Features

Run through this checklist to ensure everything works:

### Folder Management
- [ ] Create root folder
- [ ] Create nested subfolder
- [ ] Rename folder
- [ ] Delete empty folder
- [ ] Delete folder with files (recursive)
- [ ] Right-click context menu works

### Navigation
- [ ] Click folder in sidebar navigates
- [ ] Click folder card navigates
- [ ] Breadcrumb shows correct path
- [ ] Click breadcrumb navigates back
- [ ] "All Files" returns to root

### Upload
- [ ] Upload to current folder
- [ ] Upload with "organize by date"
- [ ] Files go to correct S3 path
- [ ] Database folder_id is correct

### File Operations
- [ ] Drag file to folder in sidebar
- [ ] Drag file to folder card
- [ ] Multi-select and drag files
- [ ] Files move successfully

### UI
- [ ] Folders shown FIRST
- [ ] Files shown AFTER folders
- [ ] Folder tree expands/collapses
- [ ] Context menu appears on right-click
- [ ] Folder colors display correctly

---

## 🎉 You're Ready!

The complete Dropbox-like folder system is now running!

**Key Features**:
✅ Hierarchical folder navigation
✅ Date-based auto-organization
✅ Drag-and-drop file moving
✅ Folder context menus
✅ Breadcrumb navigation
✅ **Folders shown FIRST**
✅ Upload to specific folders
✅ Backward compatible

**Access the app**: [http://localhost:3000/media-library](http://localhost:3000/media-library)

Happy organizing! 📁✨
