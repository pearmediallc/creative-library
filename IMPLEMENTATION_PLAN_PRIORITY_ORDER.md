# Complete End-to-End Implementation Plan
**Priority: Features that make logical sense to users**

---

## 🎯 PRIORITY 1: Fix What's Broken (Must Do First)

### 1.1 Fix ShareDialog Import (15 min)
**File:** `frontend/src/components/ShareDialog.tsx`

**Current Problem:**
```typescript
import { User } from '../types';  // This is a TYPE
// But code tries to use: <User /> as JSX element
```

**Fix:**
```typescript
// Line 2 - Change import:
import { User as UserIcon } from 'lucide-react';  // Icon from lucide
import { User } from '../types';  // Type from types

// Then replace all <User /> with <UserIcon />
```

---

### 1.2 Implement Missing Backend Controllers (2 hours)

#### mediaController.js - Add these methods:

```javascript
// Get file activity timeline
async getFileActivity(req, res) {
  try {
    const { id } = req.params;

    const result = await this.pool.query(
      `SELECT fol.*, u.name as user_name, u.email as user_email
       FROM file_operations_log fol
       LEFT JOIN users u ON fol.user_id = u.id
       WHERE fol.file_id = $1
       ORDER BY fol.created_at DESC
       LIMIT 50`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get file activity error:', error);
    res.status(500).json({ error: 'Failed to fetch file activity' });
  }
}

// Rename file
async renameFile(req, res) {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'New name is required' });
    }

    const result = await this.pool.query(
      `UPDATE media_files
       SET original_filename = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newName.trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Log activity
    await this.pool.query(
      `INSERT INTO file_operations_log (file_id, user_id, operation, details)
       VALUES ($1, $2, 'rename', $3)`,
      [id, req.user.id, JSON.stringify({ newName: newName.trim() })]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Rename file error:', error);
    res.status(500).json({ error: 'Failed to rename file' });
  }
}

// Get deleted files
async getDeletedFiles(req, res) {
  try {
    const result = await this.pool.query(
      `SELECT
        mf.*,
        u.name as uploader_name,
        e.display_name as editor_name,
        du.name as deleted_by_name
       FROM media_files mf
       LEFT JOIN users u ON mf.uploaded_by = u.id
       LEFT JOIN editors e ON mf.editor_id = e.id
       LEFT JOIN users du ON mf.deleted_by = du.id
       WHERE mf.is_deleted = TRUE
       ORDER BY mf.deleted_at DESC`,
      []
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get deleted files error:', error);
    res.status(500).json({ error: 'Failed to fetch deleted files' });
  }
}
```

#### folderController.js - Add this method:

```javascript
async renameFolder(req, res) {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'New name is required' });
    }

    const result = await this.pool.query(
      `UPDATE folders
       SET name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newName.trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Rename folder error:', error);
    res.status(500).json({ error: 'Failed to rename folder' });
  }
}
```

---

## 🎯 PRIORITY 2: Complete Team Management (FULL END-TO-END)

### Why This Matters:
User is right - "Create Team" button without ability to add members is USELESS.

### 2.1 Backend Routes & Controllers (3 hours)

**File:** `backend/src/routes/teams.js`

Add these routes:
```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const teamController = require('../controllers/teamController');

// ... existing routes ...

// Team member management
router.get('/:id/members', authenticateToken, teamController.getMembers);
router.post('/:id/members', requireAdmin, teamController.addMember);
router.delete('/:id/members/:userId', requireAdmin, teamController.removeMember);
router.patch('/:id/members/:userId/role', requireAdmin, teamController.updateMemberRole);

module.exports = router;
```

**File:** `backend/src/controllers/teamController.js`

Add these methods:
```javascript
// Get all members of a team
async getMembers(req, res) {
  try {
    const { id } = req.params;

    const result = await this.pool.query(
      `SELECT
        tm.*,
        u.name, u.email, u.role as user_role,
        added_by_user.name as added_by_name
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       LEFT JOIN users added_by_user ON tm.added_by = added_by_user.id
       WHERE tm.team_id = $1 AND tm.is_active = TRUE
       ORDER BY tm.joined_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get team members error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
}

// Add member to team
async addMember(req, res) {
  try {
    const { id } = req.params;  // team_id
    const { userId, teamRole } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user already in team
    const existing = await this.pool.query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already in team' });
    }

    const result = await this.pool.query(
      `INSERT INTO team_members (team_id, user_id, team_role, added_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, userId, teamRole || 'member', req.user.id]
    );

    res.json({
      success: true,
      message: 'Member added successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Add team member error:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
}

// Remove member from team
async removeMember(req, res) {
  try {
    const { id, userId } = req.params;

    const result = await this.pool.query(
      `UPDATE team_members
       SET is_active = FALSE, removed_at = NOW()
       WHERE team_id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in team' });
    }

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    logger.error('Remove team member error:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
}

// Update member role
async updateMemberRole(req, res) {
  try {
    const { id, userId } = req.params;
    const { teamRole } = req.body;

    if (!teamRole) {
      return res.status(400).json({ error: 'Team role is required' });
    }

    const result = await this.pool.query(
      `UPDATE team_members
       SET team_role = $1
       WHERE team_id = $2 AND user_id = $3
       RETURNING *`,
      [teamRole, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in team' });
    }

    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Update member role error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
}
```

### 2.2 Frontend API (30 min)

**File:** `frontend/src/lib/api.ts`

Add:
```typescript
export const teamApi = {
  // ... existing methods ...

  getMembers: (teamId: string) =>
    api.get(`/teams/${teamId}/members`),

  addMember: (teamId: string, userId: string, teamRole?: string) =>
    api.post(`/teams/${teamId}/members`, { userId, teamRole }),

  removeMember: (teamId: string, userId: string) =>
    api.delete(`/teams/${teamId}/members/${userId}`),

  updateMemberRole: (teamId: string, userId: string, teamRole: string) =>
    api.patch(`/teams/${teamId}/members/${userId}/role`, { teamRole }),
};
```

### 2.3 Frontend UI - Complete TeamMembersModal (2 hours)

**File:** `frontend/src/components/TeamMembersModal.tsx`

COMPLETE implementation:
```typescript
import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Shield } from 'lucide-react';
import { teamApi, adminApi } from '../lib/api';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface TeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  isAdmin: boolean;
}

export function TeamMembersModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  isAdmin
}: TeamMembersModalProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTeamData();
    }
  }, [isOpen, teamId]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const [membersRes, usersRes] = await Promise.all([
        teamApi.getMembers(teamId),
        isAdmin ? adminApi.getUsers() : Promise.resolve({ data: { data: [] } })
      ]);

      const teamMembers = membersRes.data.data || [];
      const allUsers = usersRes.data.data || [];

      // Filter out users already in team
      const memberIds = new Set(teamMembers.map((m: any) => m.user_id));
      const available = allUsers.filter((u: any) => !memberIds.has(u.id));

      setMembers(teamMembers);
      setAvailableUsers(available);
    } catch (error: any) {
      console.error('Failed to fetch team data:', error);
      alert(error.response?.data?.error || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) {
      alert('Please select a user');
      return;
    }

    try {
      setAdding(true);
      await teamApi.addMember(teamId, selectedUserId, selectedRole);
      alert('Member added successfully');
      setSelectedUserId('');
      setSelectedRole('member');
      await fetchTeamData();
    } catch (error: any) {
      console.error('Failed to add member:', error);
      alert(error.response?.data?.error || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!window.confirm(`Remove ${userName} from team?`)) return;

    try {
      await teamApi.removeMember(teamId, userId);
      alert('Member removed successfully');
      await fetchTeamData();
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      alert(error.response?.data?.error || 'Failed to remove member');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">Team Members: {teamName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add Member Section */}
          {isAdmin && availableUsers.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <UserPlus size={20} />
                Add Team Member
              </h3>
              <div className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg"
                >
                  <option value="">Select user...</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email}) - {user.role}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
                <Button
                  onClick={handleAddMember}
                  disabled={!selectedUserId || adding}
                >
                  {adding ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </div>
          )}

          {/* Members List */}
          <div>
            <h3 className="font-semibold mb-3">
              Current Members ({members.length})
            </h3>

            {loading ? (
              <p className="text-gray-500">Loading members...</p>
            ) : members.length === 0 ? (
              <p className="text-gray-500">No members yet. Add members above.</p>
            ) : (
              <div className="space-y-2">
                {members.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{member.name}</div>
                      <div className="text-sm text-gray-500">{member.email}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Role: {member.team_role} | Joined: {new Date(member.joined_at).toLocaleDateString()}
                        {member.added_by_name && ` | Added by: ${member.added_by_name}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {member.team_role}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveMember(member.user_id, member.name)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Remove member"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </Card>
    </div>
  );
}
```

**Result:** Now teams are ACTUALLY USEFUL - you can add/remove members!

---

## 🎯 PRIORITY 3: Fix Advanced Filters Backend (2 hours)

### Problem:
Frontend sends: `mediaType=image,video&editorIds=id1,id2`
Backend expects: Single values only

### Solution:

**File:** `backend/src/controllers/mediaController.js`

In the `getAll` method, change filter parsing:

```javascript
async getAll(req, res) {
  try {
    const {
      search,
      mediaType,  // Can be comma-separated: "image,video"
      editorIds,  // Can be comma-separated: "id1,id2,id3"
      buyerIds,   // Can be comma-separated
      folderIds,  // Can be comma-separated
      tags,       // Can be comma-separated
      dateFrom,
      dateTo,
      sizeMin,
      sizeMax,
      widthMin,
      widthMax,
      heightMin,
      heightMax,
      page = 1,
      limit = 50
    } = req.query;

    let query = `
      SELECT
        mf.*,
        u.name as uploader_name,
        e.display_name as editor_name
      FROM media_files mf
      LEFT JOIN users u ON mf.uploaded_by = u.id
      LEFT JOIN editors e ON mf.editor_id = e.id
      WHERE mf.is_deleted = FALSE
    `;

    const params = [];
    let paramIndex = 1;

    // Search filter
    if (search) {
      query += ` AND mf.original_filename ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Media type filter - support multiple types
    if (mediaType) {
      const types = mediaType.split(',').map(t => t.trim()).filter(Boolean);
      if (types.length > 0) {
        query += ` AND mf.file_type = ANY($${paramIndex})`;
        params.push(types);
        paramIndex++;
      }
    }

    // Editor filter - support multiple editors
    if (editorIds) {
      const ids = editorIds.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        query += ` AND mf.editor_id = ANY($${paramIndex})`;
        params.push(ids);
        paramIndex++;
      }
    }

    // Buyer filter - support multiple buyers
    if (buyerIds) {
      const ids = buyerIds.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        query += ` AND mf.assigned_buyer_id = ANY($${paramIndex})`;
        params.push(ids);
        paramIndex++;
      }
    }

    // Folder filter - support multiple folders
    if (folderIds) {
      const ids = folderIds.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        query += ` AND mf.folder_id = ANY($${paramIndex})`;
        params.push(ids);
        paramIndex++;
      }
    }

    // Tags filter - support multiple tags
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        query += ` AND mf.tags && $${paramIndex}`;
        params.push(tagList);
        paramIndex++;
      }
    }

    // Date range filter
    if (dateFrom) {
      query += ` AND mf.created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      query += ` AND mf.created_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    // File size filter
    if (sizeMin) {
      query += ` AND mf.file_size >= $${paramIndex}`;
      params.push(sizeMin);
      paramIndex++;
    }

    if (sizeMax) {
      query += ` AND mf.file_size <= $${paramIndex}`;
      params.push(sizeMax);
      paramIndex++;
    }

    // Dimensions filter
    if (widthMin) {
      query += ` AND mf.width >= $${paramIndex}`;
      params.push(widthMin);
      paramIndex++;
    }

    if (widthMax) {
      query += ` AND mf.width <= $${paramIndex}`;
      params.push(widthMax);
      paramIndex++;
    }

    if (heightMin) {
      query += ` AND mf.height >= $${paramIndex}`;
      params.push(heightMin);
      paramIndex++;
    }

    if (heightMax) {
      query += ` AND mf.height <= $${paramIndex}`;
      params.push(heightMax);
      paramIndex++;
    }

    query += ` ORDER BY mf.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await this.pool.query(query, params);

    res.json({
      success: true,
      data: {
        files: result.rows,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
}
```

**Result:** Filters now work with multiple selections!

---

## 🎯 PRIORITY 4: Add Deleted Files to Sidebar (30 min)

**File:** `frontend/src/components/layout/DashboardLayout.tsx`

Find the sidebar navigation and add:
```typescript
<NavLink to="/deleted" icon={Trash2} label="Deleted Files" />
```

**File:** `frontend/src/App.tsx`

Add route:
```typescript
<Route path="/deleted" element={<DeletedFilesPage />} />
```

**Result:** Users can now access deleted files and restore them!

---

## 🎯 PRIORITY 5: Fix File Requests (Complete End-to-End) (3 hours)

**This needs FULL implementation - UI exists but logic is broken**

Will provide complete implementation separately due to size.

---

## Summary of Truly Broken Features:

| Feature | Status | What's Missing |
|---------|--------|----------------|
| **Teams** | UI exists | ❌ Can't add/remove members |
| **ShareDialog** | UI exists | ❌ Import error prevents compilation |
| **Filters** | UI exists | ❌ Backend doesn't support arrays |
| **Deleted Files** | UI exists | ❌ No sidebar link |
| **File Requests** | UI exists | ❌ Editor/buyer dropdown, Create button logic |
| **Smart Collections** | UI exists | ❌ JSON validation broken |
| **Rename** | UI exists | ❌ API endpoint mismatch |
| **Activity Timeline** | UI exists | ❌ Backend controller missing |

**Pattern:** UI exists, backend/logic missing. This is what we're fixing.
