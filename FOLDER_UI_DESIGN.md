# 📁 Folder UI Design - Media Dashboard

## Overview
The Media Dashboard will show **FOLDERS FIRST**, then files. Just like Dropbox, users navigate through folders to see files.

---

## 🎨 Media Dashboard Layout

### Left Sidebar (Folder Tree)
```
┌─────────────────────────────────┐
│  📁 All Files                   │
│  ├─ 📁 jan2024                  │ ← Auto-created date folder
│  │  ├─ 📁 01-jan                │ ← Auto-created day folder
│  │  ├─ 📁 15-jan                │
│  │  └─ 📁 31-jan                │
│  ├─ 📁 feb2024                  │
│  │  └─ 📁 14-feb                │
│  ├─ 📁 Campaign Assets          │ ← User-created folder
│  │  ├─ 📁 Q1 Campaign           │
│  │  └─ 📁 Q2 Campaign           │
│  └─ 📁 Archive                  │
└─────────────────────────────────┘
```

**Features:**
- Expandable/collapsible folders (click arrow to expand)
- Auto-created date folders have calendar icon 📅
- User-created folders have folder icon 📁
- Click folder name to navigate to it
- Right-click for context menu (rename, delete, share)

---

### Main Content Area

#### **View 1: Root Level (All Files)**
Shows top-level folders + files without folder assignment

```
┌─────────────────────────────────────────────────────────────────┐
│  Breadcrumb: 🏠 Home                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📁 jan2024          📁 feb2024        📁 Campaign Assets       │
│  15 files            23 files          142 files                │
│                                                                  │
│  📁 mar2024          📁 Archive                                 │
│  8 files             451 files                                  │
│                                                                  │
│  ──────────────── Files (Root) ────────────────                │
│                                                                  │
│  🖼️ image1.jpg      🖼️ image2.jpg     🎬 video1.mp4           │
│  2.3 MB             1.8 MB             45.2 MB                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- ✅ Folders shown FIRST with file count
- ✅ Files shown AFTER all folders
- ✅ Clean separation between folders and files
- ✅ Click folder to navigate into it

---

#### **View 2: Inside a Folder (jan2024)**
Shows subfolders and files in that folder

```
┌─────────────────────────────────────────────────────────────────┐
│  Breadcrumb: 🏠 Home > 📁 jan2024                                │
├─────────────────────────────────────────────────────────────────┤
│  [← Back]  [New Folder]  [Upload Files]                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📁 01-jan           📁 15-jan         📁 31-jan                │
│  8 files             12 files          3 files                  │
│                                                                  │
│  ──────────────── Files (jan2024) ─────────────────            │
│                                                                  │
│  🖼️ banner.jpg      🖼️ logo.png      🎬 promo.mp4             │
│  3.2 MB             890 KB             12.1 MB                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

#### **View 3: Deep Navigation (jan2024 > 15-jan)**
```
┌─────────────────────────────────────────────────────────────────┐
│  Breadcrumb: 🏠 Home > 📁 jan2024 > 📁 15-jan                   │
├─────────────────────────────────────────────────────────────────┤
│  [← Back]  [New Folder]  [Upload Files]                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ──────────────── Files (15-jan) ──────────────────            │
│                                                                  │
│  🖼️ creative1.jpg   🖼️ creative2.jpg  🖼️ creative3.jpg        │
│  2.1 MB             2.5 MB             1.9 MB                   │
│                                                                  │
│  🎬 video-ad.mp4    🎬 story.mp4                                │
│  34.2 MB            18.7 MB                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Folder Card Design

### Folder Card (Grid View)
```
┌─────────────────────┐
│  📁                 │ ← Large folder icon
│                     │
│  jan2024            │ ← Folder name
│  15 files           │ ← File count
│  Modified: Jan 15   │ ← Last modified
└─────────────────────┘
```

**Hover Actions:**
- ✏️ Rename
- 🗑️ Delete
- 📤 Share
- ➡️ Move
- ℹ️ Details

---

### File Card (Grid View)
```
┌─────────────────────┐
│  [Thumbnail]        │ ← Image preview or video thumbnail
│                     │
│  creative1.jpg      │ ← Filename
│  2.1 MB             │ ← File size
│  Jan 15, 2024       │ ← Upload date
└─────────────────────┘
```

---

## 🎯 Upload Flow with Folders

### Option 1: Upload to Current Folder
```
User is in: jan2024/15-jan
Clicks "Upload Files"
→ Files uploaded to: jan2024/15-jan/
```

### Option 2: Upload with Date Auto-Organization
```
User clicks "Upload Files"
Modal shows:
  ┌──────────────────────────────────┐
  │  Upload Files                    │
  ├──────────────────────────────────┤
  │  [Drag files here or click]      │
  │                                  │
  │  ☑️ Organize by date             │ ← Checkbox
  │                                  │
  │  📁 Target folder:               │
  │  [Dropdown: Auto (jan2024/15-jan)]│
  │           or Custom folder       │
  │                                  │
  │  [Cancel]  [Upload]              │
  └──────────────────────────────────┘
```

If "Organize by date" is checked:
- Upload date: Jan 15, 2024
- Auto-creates: `jan2024/15-jan/`
- Files go there

If custom folder selected:
- Files go to selected folder
- No auto-date folders created

---

## 📊 Folder Context Menu (Right-Click)

```
┌──────────────────────┐
│  Open               │ ← Navigate into folder
│  ──────────────────  │
│  ✏️ Rename          │
│  📤 Share           │ ← Share with team members
│  📋 Copy            │
│  ➡️ Move to...      │
│  ──────────────────  │
│  ℹ️ Details         │
│  📊 Properties       │
│  ──────────────────  │
│  🗑️ Delete          │
└──────────────────────┘
```

---

## 🔍 Folder Search & Filter

### Filter Panel (Left Sidebar - Bottom)
```
┌─────────────────────────────────┐
│  🔍 Search folders & files      │
│  [___________________]          │
│                                 │
│  Filters                        │
│  ☑️ Folders only                │
│  ☐ Files only                   │
│  ☐ Show deleted                 │
│                                 │
│  Date Range                     │
│  From: [___] To: [___]          │
│                                 │
│  File Type                      │
│  ☐ Images                       │
│  ☐ Videos                       │
│                                 │
│  Editor                         │
│  ☐ Deep                         │
│  ☐ Arun                         │
│  ☐ Chetan                       │
└─────────────────────────────────┘
```

---

## 🎨 Color Coding (Optional)

Users can assign colors to folders for visual organization:

```
📁 jan2024           (Blue)     ← Date folders auto-blue
📁 Campaign Assets   (Green)    ← Active campaigns
📁 Archive           (Gray)     ← Archived content
📁 Q1 Creatives      (Orange)   ← User-assigned color
```

---

## 📱 Responsive Behavior

### Desktop (>1024px)
- Left sidebar: Fixed 280px width
- Main content: Grid view (4 columns)
- Folders and files in grid cards

### Tablet (768-1024px)
- Left sidebar: Collapsible
- Main content: Grid view (3 columns)

### Mobile (<768px)
- Left sidebar: Hidden (hamburger menu)
- Main content: List view (1 column)
- Folders shown with icon and name
- Tap to navigate

---

## 🔄 Drag & Drop

### Drag File to Folder
```
User drags image1.jpg
Hovers over folder "Campaign Assets"
→ Folder highlights with blue border
User drops
→ File moves to Campaign Assets
```

### Drag Multiple Files
```
User selects 5 files (checkboxes)
Drags selection
Drops on folder
→ All 5 files move
```

---

## 📋 Breadcrumb Navigation

Always shows current path with clickable links:

```
🏠 Home > 📁 jan2024 > 📁 15-jan > 📁 Creatives
        ↑           ↑          ↑
      Click       Click      Click
      to go       to go      to go
      home        to         to
                  jan2024    15-jan
```

---

## 🎯 Key Features Summary

✅ **Folders displayed FIRST**, then files
✅ **Hierarchical navigation** (breadcrumbs)
✅ **Auto date folders**: `jan2024/15-jan/`
✅ **User custom folders**: `Campaign Assets/Q1/`
✅ **Drag & drop** file moving
✅ **Context menus** for all actions
✅ **Color coding** for organization
✅ **Search & filter** across folders
✅ **Responsive** for all devices
✅ **Exactly like Dropbox** experience

---

## 🚀 Next: Frontend Implementation

Now I'll build the actual React components to match this design!
