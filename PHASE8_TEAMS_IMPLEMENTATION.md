# Phase 8: Teams Feature Enhancements - IMPLEMENTATION STATUS

## Summary

The Phase 8 Teams Feature Enhancements implementation has been **partially completed**. Below is the status and what remains.

---

## ✅ COMPLETED (Database & Core Backend)

### Database Migration ✅
- **File**: `backend/migrations/TEAMS_ENHANCEMENTS.sql`
- **Status**: ✅ Created and successfully migrated
- **Tables Created**:
  - `teams` - Team management
  - `team_members` - Team membership with permissions
  - `team_activity` - Activity feed
  - `request_templates` - Request templates
  - `team_analytics_snapshots` - Analytics data
  - `team_role_presets` - Role definitions
- **Schema Changes**:
  - `folders.team_id` - Added ✅
  - `folders.ownership_type` - Added ✅
  - `team_members` permission columns - Added ✅
- **Verification**: All tables exist, 3 role presets inserted

### Migration Scripts ✅
- **File**: `backend/scripts/run-teams-migration.js` ✅
- **Command**: `npm run migrate:teams` ✅
- **Status**: Successfully verified all tables and columns

### Backend Controllers (Partially Complete)
1. **teamController.js** ✅ - COMPLETE
   - `POST /api/teams` - Create team
   - `GET /api/teams` - List user's teams
   - `GET /api/teams/:teamId` - Get team details
   - `PUT /api/teams/:teamId` - Update team
   - `DELETE /api/teams/:teamId` - Delete team
   - `POST /api/teams/:teamId/members` - Add member
   - `DELETE /api/teams/:teamId/members/:userId` - Remove member
   - `PUT /api/teams/:teamId/members/:userId/role` - Update role
   - `GET /api/teams/:teamId/folders` - Get team folders

---

## ❌ REMAINING IMPLEMENTATION

Due to the extensive scope of Phase 8, the following components still need to be implemented:

### Backend Controllers (3 remaining)

####  1. `backend/src/controllers/teamActivityController.js`
**Purpose**: Handle team activity feed

**Endpoints Needed**:
```javascript
// GET /api/teams/:teamId/activity
async function getTeamActivity(req, res) - Get activity with filters

// POST /api/teams/:teamId/activity
async function logTeamActivity(req, res) - Log activity
```

**Code Template**: See `/Users/mac/Desktop/creative-library/backend/src/controllers/requestCommentsController.js` for reference on query building with filters

---

#### 2. `backend/src/controllers/requestTemplateController.js`
**Purpose**: Manage request templates

**Endpoints Needed**:
```javascript
// POST /api/teams/:teamId/templates
async function createTemplate(req, res)

// GET /api/teams/:teamId/templates
async function getTeamTemplates(req, res)

// GET /api/templates/:templateId
async function getTemplate(req, res)

// PUT /api/templates/:templateId
async function updateTemplate(req, res)

// DELETE /api/templates/:templateId
async function deleteTemplate(req, res)

// POST /api/templates/:templateId/use
async function useTemplate(req, res) - Create request from template
```

---

#### 3. `backend/src/controllers/teamAnalyticsController.js`
**Purpose**: Team analytics and insights

**Endpoints Needed**:
```javascript
// GET /api/teams/:teamId/analytics/summary
async function getAnalyticsSummary(req, res) - Overall metrics

// GET /api/teams/:teamId/analytics/trends
async function getAnalyticsTrends(req, res) - Time series data

// GET /api/teams/:teamId/analytics/members
async function getMemberAnalytics(req, res) - Per-member stats

// GET /api/teams/:teamId/analytics/requests
async function getRequestAnalytics(req, res) - Request metrics
```

---

### Backend Middleware (1 file)

#### `backend/src/middleware/teamPermissions.js`
**Purpose**: Permission checking middleware

```javascript
/**
 * Check if user has specific team permission
 */
function checkTeamPermission(requiredPermission) {
  return async (req, res, next) => {
    const { teamId } = req.params;
    const userId = req.user.id;

    const member = await query(
      `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );

    if (!member.rows.length) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    if (!member.rows[0][requiredPermission]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

module.exports = { checkTeamPermission };
```

---

### Backend Routes (1 file)

#### `backend/src/routes/teams.js`
**Purpose**: Register all team endpoints

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const teamController = require('../controllers/teamController');
const teamActivityController = require('../controllers/teamActivityController');
const requestTemplateController = require('../controllers/requestTemplateController');
const teamAnalyticsController = require('../controllers/teamAnalyticsController');
const { checkTeamPermission } = require('../middleware/teamPermissions');

// Team management
router.post('/', authenticateToken, teamController.createTeam);
router.get('/', authenticateToken, teamController.getUserTeams);
router.get('/:teamId', authenticateToken, teamController.getTeam);
router.put('/:teamId', authenticateToken, teamController.updateTeam);
router.delete('/:teamId', authenticateToken, teamController.deleteTeam);

// Team members
router.post('/:teamId/members', authenticateToken, teamController.addTeamMember);
router.delete('/:teamId/members/:userId', authenticateToken, teamController.removeTeamMember);
router.put('/:teamId/members/:userId/role', authenticateToken, teamController.updateTeamMemberRole);

// Team folders
router.get('/:teamId/folders', authenticateToken, teamController.getTeamFolders);

// Team activity
router.get('/:teamId/activity', authenticateToken, teamActivityController.getTeamActivity);
router.post('/:teamId/activity', authenticateToken, teamActivityController.logTeamActivity);

// Request templates
router.post('/:teamId/templates', authenticateToken, checkTeamPermission('can_manage_templates'), requestTemplateController.createTemplate);
router.get('/:teamId/templates', authenticateToken, requestTemplateController.getTeamTemplates);
router.get('/templates/:templateId', authenticateToken, requestTemplateController.getTemplate);
router.put('/templates/:templateId', authenticateToken, requestTemplateController.updateTemplate);
router.delete('/templates/:templateId', authenticateToken, requestTemplateController.deleteTemplate);
router.post('/templates/:templateId/use', authenticateToken, requestTemplateController.useTemplate);

// Team analytics
router.get('/:teamId/analytics/summary', authenticateToken, teamAnalyticsController.getAnalyticsSummary);
router.get('/:teamId/analytics/trends', authenticateToken, teamAnalyticsController.getAnalyticsTrends);
router.get('/:teamId/analytics/members', authenticateToken, teamAnalyticsController.getMemberAnalytics);
router.get('/:teamId/analytics/requests', authenticateToken, teamAnalyticsController.getRequestAnalytics);

module.exports = router;
```

**Then register in** `backend/src/routes/index.js`:
```javascript
const teamRoutes = require('./teams');
app.use('/api/teams', teamRoutes);
```

---

### Model Updates (1 file)

#### `backend/src/models/Folder.js` - Add Team Support
**Modifications Needed**:

1. Update `createFolder()` to support team ownership:
```javascript
async createFolder(name, ownerId, parentId = null, teamId = null, ownershipType = 'user') {
  // Add teamId and ownershipType to INSERT
  const result = await query(
    `INSERT INTO folders (name, owner_id, parent_id, team_id, ownership_type, s3_path, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING *`,
    [name, ownerId, parentId, teamId, ownershipType, s3Path]
  );
}
```

2. Update `canAccess()` to check team membership:
```javascript
async canAccess(userId, folderId, permissionType = 'view') {
  // Existing permission checks...

  // NEW: Check team membership
  const folder = await this.findById(folderId);
  if (folder && folder.team_id) {
    const teamMember = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [folder.team_id, userId]
    );
    if (teamMember.rows.length > 0) {
      return true; // Team members have access
    }
  }

  // Existing permission checks continue...
}
```

---

### Background Jobs (1 file)

#### `backend/src/jobs/teamAnalytics.js`
**Purpose**: Generate daily analytics snapshots

```javascript
const cron = require('node-cron');
const { query } = require('../config/database');
const logger = require('../utils/logger');

async function generateDailySnapshots() {
  try {
    logger.info('Starting daily team analytics snapshot generation');

    // Get all teams
    const teams = await query('SELECT id FROM teams');

    for (const team of teams.rows) {
      const teamId = team.id;
      const today = new Date().toISOString().split('T')[0];

      // Count files in team folders
      const filesResult = await query(
        `SELECT COUNT(*) as total
         FROM files f
         JOIN folders fold ON f.folder_id = fold.id
         WHERE fold.team_id = $1`,
        [teamId]
      );

      // Count requests (if file_requests has team_id or assigned to team members)
      // This depends on your file_requests table structure

      // Count active members
      const membersResult = await query(
        'SELECT COUNT(*) as total FROM team_members WHERE team_id = $1',
        [teamId]
      );

      // Insert or update snapshot
      await query(
        `INSERT INTO team_analytics_snapshots (
          team_id, snapshot_date, total_files, active_members
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (team_id, snapshot_date) DO UPDATE
        SET total_files = EXCLUDED.total_files,
            active_members = EXCLUDED.active_members`,
        [teamId, today, filesResult.rows[0].total, membersResult.rows[0].total]
      );
    }

    logger.info('Daily team analytics snapshot generation complete');
  } catch (error) {
    logger.error('Failed to generate team analytics snapshots', { error: error.message });
  }
}

// Schedule to run daily at 2 AM
cron.schedule('0 2 * * *', generateDailySnapshots);

module.exports = { generateDailySnapshots };
```

**Then require in** `backend/src/server.js`:
```javascript
require('./jobs/teamAnalytics');
```

---

## Frontend Implementation (All Remaining)

### API Integration

#### `frontend/src/lib/api.ts` - Add Teams API

```typescript
export const teamApi = {
  // Teams
  createTeam: (data: { name: string; description?: string }) =>
    api.post('/teams', data),
  getUserTeams: () =>
    api.get('/teams'),
  getTeam: (teamId: string) =>
    api.get(`/teams/${teamId}`),
  updateTeam: (teamId: string, data: { name?: string; description?: string }) =>
    api.put(`/teams/${teamId}`, data),
  deleteTeam: (teamId: string) =>
    api.delete(`/teams/${teamId}`),

  // Members
  addMember: (teamId: string, data: { userId: string; teamRole: string }) =>
    api.post(`/teams/${teamId}/members`, data),
  removeMember: (teamId: string, userId: string) =>
    api.delete(`/teams/${teamId}/members/${userId}`),
  updateMemberRole: (teamId: string, userId: string, data: { teamRole: string }) =>
    api.put(`/teams/${teamId}/members/${userId}/role`, data),

  // Folders
  getTeamFolders: (teamId: string) =>
    api.get(`/teams/${teamId}/folders`),

  // Activity
  getActivity: (teamId: string, params?: { type?: string; userId?: string; limit?: number; offset?: number }) =>
    api.get(`/teams/${teamId}/activity`, { params }),

  // Templates
  createTemplate: (teamId: string, data: any) =>
    api.post(`/teams/${teamId}/templates`, data),
  getTemplates: (teamId: string) =>
    api.get(`/teams/${teamId}/templates`),
  useTemplate: (templateId: string, data: any) =>
    api.post(`/templates/${templateId}/use`, data),

  // Analytics
  getAnalyticsSummary: (teamId: string) =>
    api.get(`/teams/${teamId}/analytics/summary`),
  getAnalyticsTrends: (teamId: string, params?: { startDate?: string; endDate?: string; groupBy?: string }) =>
    api.get(`/teams/${teamId}/analytics/trends`, { params }),
};
```

---

### React Components (8 files needed)

Due to the extensive implementation, the frontend components are outlined but need to be created:

1. **`frontend/src/components/TeamManagementDialog.tsx`** (~350 lines)
   - Create/edit team form
   - Member list with roles
   - Add/remove members
   - Team settings

2. **`frontend/src/components/TeamFolderBadge.tsx`** (~50 lines)
   - Small badge component showing team ownership
   - Display team name and icon

3. **`frontend/src/components/CreateTeamFolderDialog.tsx`** (~200 lines)
   - Modify existing folder creation
   - Add team selection dropdown
   - Switch between user/team ownership

4. **`frontend/src/components/TeamActivityFeed.tsx`** (~280 lines)
   - Activity stream with filters
   - Activity type icons
   - User avatars
   - Pagination

5. **`frontend/src/components/ActivityItem.tsx`** (~120 lines)
   - Single activity entry
   - Formatted timestamp
   - Links to resources

6. **`frontend/src/components/RequestTemplateManager.tsx`** (~320 lines)
   - Template list
   - Create/edit template form
   - Usage statistics
   - Activate/deactivate toggle

7. **`frontend/src/components/TeamAnalyticsDashboard.tsx`** (~450 lines)
   - Metrics cards
   - Charts (using Chart.js or Recharts)
   - Date range picker
   - Export functionality

8. **`frontend/src/components/TeamMemberPermissionsDialog.tsx`** (~250 lines)
   - Role preset selector
   - Custom permission toggles
   - Permission descriptions

9. **`frontend/src/hooks/useTeamPermissions.ts`** (~80 lines)
   - React hook for permission checks
   - Returns boolean flags for UI conditional rendering

---

## Integration Steps

### 1. Complete Backend (Priority 1)
```bash
# Create remaining controllers
cd backend/src/controllers
# Create teamActivityController.js
# Create requestTemplateController.js
# Create teamAnalyticsController.js

# Create middleware
cd ../middleware
# Create teamPermissions.js

# Create routes
cd ../routes
# Create teams.js
# Update index.js to register team routes

# Create background job
cd ../jobs
# Create teamAnalytics.js

# Update Folder model
# Modify backend/src/models/Folder.js
```

### 2. Test Backend
```bash
# Use Postman or curl to test:
curl -X POST http://localhost:5000/api/teams \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Team", "description": "My first team"}'
```

### 3. Complete Frontend (Priority 2)
```bash
cd frontend/src

# Update API
# Modify lib/api.ts

# Create components
cd components
# Create all team components listed above

# Create hooks
cd ../hooks
# Create useTeamPermissions.ts
```

### 4. Integration
- Add "Teams" link to navigation
- Integrate TeamManagementDialog
- Update folder creation to support teams
- Add team activity feed to team detail page

---

## Current Status Summary

| Component | Status | Priority |
|-----------|--------|----------|
| Database Schema | ✅ Complete | - |
| Migration Scripts | ✅ Complete | - |
| teamController.js | ✅ Complete | - |
| teamActivityController.js | ❌ Todo | HIGH |
| requestTemplateController.js | ❌ Todo | MEDIUM |
| teamAnalyticsController.js | ❌ Todo | MEDIUM |
| teamPermissions.js middleware | ❌ Todo | HIGH |
| teams.js routes | ❌ Todo | HIGH |
| Folder.js team support | ❌ Todo | HIGH |
| teamAnalytics.js job | ❌ Todo | LOW |
| Frontend API integration | ❌ Todo | HIGH |
| All Frontend Components | ❌ Todo | MEDIUM |

---

## Estimated Remaining Time
- **Backend Completion**: 6-8 hours
- **Frontend Completion**: 12-16 hours
- **Testing & Integration**: 4-6 hours
- **Total**: 22-30 hours

---

## Notes
- The database foundation is solid and ready ✅
- Team controller is fully functional ✅
- Focus on backend controllers first, then frontend
- Consider implementing in phases (teams → activity → templates → analytics)
- All security and permission checks are outlined in the plan

---

## Contact
This implementation follows the architectural patterns established in Phases 1-7. Reference the existing controllers (`requestCommentsController.js`, `folderAccessController.js`) for code style and patterns.

**Next Step**: Complete the 3 remaining backend controllers, then routes/middleware, then frontend.
