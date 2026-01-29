# Vertical Assignment & Reassignment Flow

## Overview
This document explains how file requests are assigned to creative editors based on verticals, and how reassignment works.

---

## 1. File Request Creation by Media Buyer

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEDIA BUYER CREATES REQUEST                  │
│                                                                 │
│  Input Fields:                                                  │
│  ✓ Title, Description, Instructions                           │
│  ✓ Platform (Meta, TikTok, YouTube, etc.)                     │
│  ✓ Vertical (Healthcare, Finance, E-commerce, etc.)  ← KEY!   │
│  ✓ Number of Creatives                                        │
│  ✓ Deadline                                                    │
│  ✓ (Optional) Manually select specific editors                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    AUTO-ASSIGNMENT LOGIC                         │
│                                                                 │
│  IF vertical is provided AND no editors manually selected:     │
│                                                                 │
│  Step 1: Check vertical_heads table                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ SELECT * FROM vertical_heads WHERE vertical = {vertical}│ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 2a: IF Vertical Head Found                              │
│  ✅ Assign to vertical head editor                             │
│  ✅ Set auto_assigned_head = vertical_head_user_id            │
│                                                                 │
│  Step 2b: IF No Vertical Head Found                           │
│  ⚠️  Use fallback editors (Parmeet & Ritu)                     │
│  ⚠️  auto_assigned_head = NULL                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FOLDER AUTO-CREATION                          │
│                                                                 │
│  Format: {BuyerName}-{YYYY-MM-DD}                              │
│  Example: "Chetan-2026-01-29"                                  │
│                                                                 │
│  IF folder exists for today: ✓ Reuse existing folder          │
│  IF folder doesn't exist: ✓ Create new folder                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION SENT                             │
│                                                                 │
│  Notification to: Assigned Editor(s)                           │
│  Type: 'file_request_assigned'                                │
│  Title: "New File Request Assigned"                           │
│  Message: "You have been assigned to '{title}' by {buyer}"    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Vertical Heads Table Structure

```sql
CREATE TABLE vertical_heads (
  id UUID PRIMARY KEY,
  vertical VARCHAR(100) NOT NULL,           -- e.g., 'Healthcare', 'Finance'
  head_editor_id UUID REFERENCES users(id), -- The vertical head (user)
  fallback_editor_ids UUID[],               -- Array of fallback editor user IDs
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Current Vertical Mappings

| Vertical | Head Editor | Fallback Editors |
|----------|-------------|------------------|
| Healthcare | (To be assigned) | Parmeet, Ritu |
| Finance | (To be assigned) | Parmeet, Ritu |
| E-commerce | (To be assigned) | Parmeet, Ritu |
| Education | (To be assigned) | Parmeet, Ritu |
| Real Estate | (To be assigned) | Parmeet, Ritu |
| *Others* | NULL | Parmeet, Ritu |

---

## 3. Reassignment Flow

### 3.1 Who Can Reassign?

```
┌─────────────────────────────────────────────────────────────────┐
│                    REASSIGNMENT PERMISSIONS                      │
│                                                                 │
│  ✅ Auto-assigned vertical head (auto_assigned_head)            │
│  ✅ Currently assigned editors                                  │
│  ✅ Admin users                                                 │
│  ❌ Other users (permission denied)                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Reassignment Process

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Vertical Head/Editor Initiates Reassignment           │
│                                                                 │
│  POST /api/file-requests/{id}/reassign                         │
│  Body: {                                                        │
│    reassign_to: "user_id_of_new_editor",                      │
│    note: "Reassigning because..."                             │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Validation Checks                                      │
│                                                                 │
│  1. ✓ Verify requester has permission to reassign              │
│  2. ✓ Verify target editor exists and is active                │
│  3. ✓ Check editor is not already assigned                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Create Reassignment Record                             │
│                                                                 │
│  INSERT INTO request_reassignments (                           │
│    file_request_id,                                            │
│    reassigned_from,  ← Current user ID                         │
│    reassigned_to,    ← New editor ID                           │
│    reassignment_note ← Optional reason                         │
│  )                                                              │
│                                                                 │
│  UPDATE file_requests                                           │
│  SET reassignment_count = reassignment_count + 1               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Add New Editor to Request                              │
│                                                                 │
│  INSERT INTO file_request_editors (                            │
│    request_id,                                                 │
│    editor_id,        ← New editor's ID                         │
│    status            ← 'pending'                               │
│  )                                                              │
│                                                                 │
│  Note: Old assignments remain (audit trail)                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Send Notification                                      │
│                                                                 │
│  Notification to: New Editor                                    │
│  Type: 'file_request_reassigned'                              │
│  Title: "File Request Reassigned to You"                      │
│  Message: "'{title}' has been reassigned to you by {name}:    │
│            {reassignment_note}"                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Reassignment History

```
GET /api/file-requests/{id}/reassignments

Response:
[
  {
    id: "uuid",
    file_request_id: "uuid",
    reassigned_from: "user_id",
    reassigned_to: "user_id",
    reassignment_note: "Need specialist for healthcare vertical",
    created_at: "2026-01-29T10:30:00Z",
    from_name: "Vertical Head",
    from_email: "head@example.com",
    to_name: "Specialist Editor",
    to_email: "editor@example.com"
  }
]
```

---

## 4. Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE WORKFLOW                               │
└──────────────────────────────────────────────────────────────────────────┘

    MEDIA BUYER
        │
        │ Creates File Request
        │ with Vertical = "Healthcare"
        ├──────────────────────────────────────────┐
        │                                          │
        ▼                                          ▼
  ┌─────────────┐                          ┌─────────────┐
  │ Auto-Create │                          │   Assign    │
  │   Folder    │                          │  to Editor  │
  │             │                          │             │
  │ Chetan-     │                          │ Check if    │
  │ 2026-01-29  │                          │ Healthcare  │
  └─────────────┘                          │ Vertical    │
        │                                  │ Head exists │
        │                                  └─────┬───────┘
        │                                        │
        │                                  ┌─────┴──────┐
        │                                  │            │
        │                              YES │            │ NO
        │                                  │            │
        │                          ┌───────▼────┐  ┌────▼──────┐
        │                          │ Healthcare │  │ Fallback  │
        │                          │ Vertical   │  │ Editors:  │
        │                          │   Head     │  │ Parmeet & │
        │                          │            │  │   Ritu    │
        │                          └───────┬────┘  └────┬──────┘
        │                                  │            │
        │                                  └────┬───────┘
        │                                       │
        │                                 ┌─────▼──────┐
        │                                 │ Notification│
        │                                 │   Sent      │
        │                                 └─────┬──────┘
        │                                       │
        │                                       ▼
        │                              ┌─────────────────┐
        │                              │ Editor Receives │
        │                              │   Assignment    │
        │                              └────────┬────────┘
        │                                       │
        │                                       │ Decides to Reassign
        │                                       │
        │                                       ▼
        │                              ┌─────────────────┐
        │                              │ POST reassign   │
        │                              │ with note       │
        │                              └────────┬────────┘
        │                                       │
        │                                       ▼
        │                              ┌─────────────────┐
        │                              │ New Editor      │
        │                              │ Added to        │
        │                              │ Request         │
        │                              └────────┬────────┘
        │                                       │
        │                                       ▼
        └────────────────────┬───────────┬─────────────────┐
                             │           │                 │
                             ▼           ▼                 ▼
                       ┌──────────┬──────────┬──────────────┐
                       │ Upload 1 │ Upload 2 │  Upload 3    │
                       │  .mp4    │  .jpg    │   .png       │
                       └────┬─────┴────┬─────┴──────┬───────┘
                            │          │            │
                            └──────────┴────────────┘
                                       │
                                  ALL GO TO:
                            Chetan-2026-01-29/
                            (Auto-created folder)
```

---

## 5. Database Tables Reference

### file_requests
```sql
CREATE TABLE file_requests (
  id UUID PRIMARY KEY,
  title VARCHAR(255),
  vertical VARCHAR(100),              -- Used for auto-assignment
  auto_assigned_head UUID,            -- Vertical head user ID
  reassignment_count INTEGER DEFAULT 0,
  ...
);
```

### file_request_editors
```sql
CREATE TABLE file_request_editors (
  id UUID PRIMARY KEY,
  request_id UUID REFERENCES file_requests(id),
  editor_id UUID REFERENCES editors(id),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP,
  UNIQUE(request_id, editor_id)
);
```

### request_reassignments
```sql
CREATE TABLE request_reassignments (
  id UUID PRIMARY KEY,
  file_request_id UUID REFERENCES file_requests(id),
  reassigned_from UUID REFERENCES users(id),
  reassigned_to UUID REFERENCES users(id),
  reassignment_note TEXT,
  created_at TIMESTAMP
);
```

---

## 6. Key Features

### ✅ Auto-Assignment Benefits
1. **No Manual Selection Required**: Buyer just picks vertical
2. **Intelligent Routing**: Requests go to domain experts
3. **Fallback System**: Always has backup editors
4. **Scalable**: Easy to add new verticals and heads

### ✅ Folder Organization
1. **Date-Based**: One folder per buyer per day
2. **Automatic Reuse**: Multiple requests on same day share folder
3. **Clear Naming**: "BuyerName-YYYY-MM-DD"
4. **No Manual Folder Selection**: Fully automated

### ✅ Reassignment Tracking
1. **Full Audit Trail**: All reassignments logged
2. **Reassignment Notes**: Context for why reassignment happened
3. **Permission-Based**: Only authorized users can reassign
4. **Notification System**: New editor gets notified immediately

---

## 7. API Endpoints Summary

| Endpoint | Method | Purpose | Who Can Access |
|----------|--------|---------|----------------|
| `/api/file-requests` | POST | Create request | Buyers, Admins |
| `/api/file-requests/:id/assign-editors` | POST | Manually assign | Request creator |
| `/api/file-requests/:id/reassign` | POST | Reassign to another editor | Vertical head, Current editors, Admins |
| `/api/file-requests/:id/reassignments` | GET | View reassignment history | Request creator, Assigned editors, Admins |
| `/api/file-requests/:id/editors` | GET | Get assigned editors | Request creator, Assigned editors, Admins |

---

## 8. Example Scenarios

### Scenario 1: Auto-Assignment to Vertical Head
```
Buyer: Creates request with Vertical = "Healthcare"
System: Finds Healthcare Vertical Head → Assigns to them
Result: ✅ Request assigned to Healthcare specialist
```

### Scenario 2: Auto-Assignment with Fallback
```
Buyer: Creates request with Vertical = "Real Estate"
System: No Real Estate Vertical Head found → Uses fallback
Result: ✅ Request assigned to Parmeet & Ritu
```

### Scenario 3: Vertical Head Reassigns
```
Healthcare Head: Receives request, realizes they're busy
Healthcare Head: Reassigns to another healthcare editor with note
Result: ✅ New editor gets request + notification with context
```

### Scenario 4: Same-Day Folder Reuse
```
9:00 AM - Buyer creates Request A → Folder "Chetan-2026-01-29" created
2:00 PM - Buyer creates Request B → Folder "Chetan-2026-01-29" reused
Result: ✅ Both requests use same folder, organized by date
```

---

## 9. Benefits Summary

| Feature | Benefit |
|---------|---------|
| Vertical-Based Assignment | Requests automatically go to domain experts |
| Fallback System | No request left unassigned |
| Dated Folders | Easy to find files by date, one folder per day |
| Reassignment with Notes | Flexible workflow with full context |
| Audit Trail | Complete history of who worked on what |
| Notifications | Everyone stays informed of assignments |

---

**Generated with Claude Code**
