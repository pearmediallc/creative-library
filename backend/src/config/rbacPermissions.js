/**
 * RBAC Permission Matrix
 *
 * Defines the default permissions for each role across all resource types.
 * Used as the source of truth for role-based permission checks.
 */

const RBAC_PERMISSIONS = {
  admin: {
    media: ['view', 'upload', 'download', 'edit', 'delete', 'move', 'copy', 'share', 'bulk_edit', 'bulk_delete', 'bulk_download', 'bulk_move', 'bulk_copy'],
    folders: ['view', 'create', 'rename', 'delete', 'share', 'color'],
    file_requests: ['view', 'create', 'edit', 'delete', 'duplicate', 'close', 'launch', 'reopen', 'reassign', 'upload'],
    workload: ['view', 'manage_capacity'],
    users: ['view', 'create', 'edit', 'delete', 'assign_roles'],
    teams: ['view', 'create', 'edit', 'delete', 'manage_members'],
  },
  buyer: {
    media: ['view', 'download', 'share', 'bulk_download'],
    folders: ['view', 'create', 'share'],
    file_requests: ['view', 'create', 'edit', 'duplicate', 'close', 'launch', 'reopen', 'upload'],
    workload: ['view'],
    teams: ['view'],
  },
  creative: {
    media: ['view', 'upload', 'download', 'edit', 'move', 'copy', 'share', 'bulk_edit', 'bulk_download', 'bulk_move', 'bulk_copy'],
    folders: ['view', 'create', 'rename', 'share', 'color'],
    file_requests: ['view', 'upload'],
    workload: ['view'],
    teams: ['view'],
  },
  vertical_head: {
    media: ['view', 'upload', 'download', 'edit', 'delete', 'move', 'copy', 'share', 'bulk_edit', 'bulk_delete', 'bulk_download', 'bulk_move', 'bulk_copy'],
    folders: ['view', 'create', 'rename', 'delete', 'share', 'color'],
    file_requests: ['view', 'create', 'edit', 'delete', 'duplicate', 'close', 'launch', 'reopen', 'reassign', 'upload'],
    workload: ['view', 'manage_capacity'],
    teams: ['view', 'create', 'edit', 'manage_members'],
  },
  team_lead: {
    media: ['view', 'upload', 'download', 'edit', 'move', 'copy', 'share', 'bulk_edit', 'bulk_download', 'bulk_move', 'bulk_copy'],
    folders: ['view', 'create', 'rename', 'share', 'color'],
    file_requests: ['view', 'create', 'edit', 'duplicate', 'upload'],
    workload: ['view'],
    teams: ['view', 'create', 'edit', 'manage_members'],
  },
  assistant_team_lead: {
    media: ['view', 'upload', 'download', 'edit', 'move', 'copy', 'share', 'bulk_edit', 'bulk_download', 'bulk_move', 'bulk_copy'],
    folders: ['view', 'create', 'rename', 'share', 'color'],
    file_requests: ['view', 'create', 'edit', 'reassign', 'upload'],
    workload: ['view'],
    teams: ['view'],
  },
};

/**
 * All resource types in the system
 */
const RESOURCE_TYPES = ['media', 'folders', 'file_requests', 'workload', 'users', 'teams'];

/**
 * All possible actions per resource type
 */
const ALL_ACTIONS = {
  media: ['view', 'upload', 'download', 'edit', 'delete', 'move', 'copy', 'share', 'bulk_edit', 'bulk_delete', 'bulk_download', 'bulk_move', 'bulk_copy'],
  folders: ['view', 'create', 'rename', 'delete', 'share', 'color'],
  file_requests: ['view', 'create', 'edit', 'delete', 'duplicate', 'close', 'launch', 'reopen', 'reassign', 'upload'],
  workload: ['view', 'manage_capacity'],
  users: ['view', 'create', 'edit', 'delete', 'assign_roles'],
  teams: ['view', 'create', 'edit', 'delete', 'manage_members'],
};

/**
 * All role names
 */
const ROLES = ['admin', 'buyer', 'creative', 'vertical_head', 'team_lead', 'assistant_team_lead'];

/**
 * Check if a given set of roles (primary + additional) has permission for a resource action.
 *
 * @param {string} primaryRole - The user's primary role
 * @param {string[]} additionalRoles - Array of additional roles the user holds
 * @param {string} resource - The resource type (e.g., 'media', 'folders')
 * @param {string} action - The action to check (e.g., 'view', 'upload', 'delete')
 * @returns {boolean} Whether any of the user's roles grants the permission
 */
function hasPermission(primaryRole, additionalRoles = [], resource, action) {
  const allRoles = [primaryRole, ...(additionalRoles || [])];

  for (const role of allRoles) {
    const rolePermissions = RBAC_PERMISSIONS[role];
    if (!rolePermissions) continue;

    const resourcePermissions = rolePermissions[resource];
    if (!resourcePermissions) continue;

    if (resourcePermissions.includes(action)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the merged permission set for a user across all their roles.
 *
 * @param {string} primaryRole - The user's primary role
 * @param {string[]} additionalRoles - Array of additional roles
 * @returns {Object} Merged permissions object keyed by resource type
 */
function getMergedPermissions(primaryRole, additionalRoles = []) {
  const allRoles = [primaryRole, ...(additionalRoles || [])];
  const merged = {};

  for (const resource of RESOURCE_TYPES) {
    const actions = new Set();
    for (const role of allRoles) {
      const rolePerms = RBAC_PERMISSIONS[role];
      if (rolePerms && rolePerms[resource]) {
        rolePerms[resource].forEach(action => actions.add(action));
      }
    }
    merged[resource] = Array.from(actions);
  }

  return merged;
}

module.exports = {
  RBAC_PERMISSIONS,
  RESOURCE_TYPES,
  ALL_ACTIONS,
  ROLES,
  hasPermission,
  getMergedPermissions,
};
