import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * RBAC Permission Matrix - mirrors backend/src/config/rbacPermissions.js
 * Keep in sync with the backend definition.
 */
const RBAC_PERMISSIONS: Record<string, Record<string, string[]>> = {
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
 * Check if a set of roles has permission for a resource action.
 */
export function hasPermission(
  primaryRole: string,
  additionalRoles: string[],
  resource: string,
  action: string
): boolean {
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
 * Hook that provides RBAC permission checks for the current user.
 *
 * Usage:
 *   const { can, canAny, canAll } = useRBAC();
 *   if (can('media', 'upload')) { ... }
 *   if (canAny('media', ['edit', 'delete'])) { ... }
 */
export function useRBAC() {
  const { user } = useAuth();

  const primaryRole = user?.role || '';
  const additionalRoles: string[] = (user as any)?.additional_roles || [];
  const additionalRolesKey = additionalRoles.join(',');

  const can = useMemo(() => {
    return (resource: string, action: string): boolean => {
      if (!primaryRole) return false;
      return hasPermission(primaryRole, additionalRoles, resource, action);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryRole, additionalRolesKey]);

  const canAny = useMemo(() => {
    return (resource: string, actions: string[]): boolean => {
      if (!primaryRole) return false;
      return actions.some(action => hasPermission(primaryRole, additionalRoles, resource, action));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryRole, additionalRolesKey]);

  const canAll = useMemo(() => {
    return (resource: string, actions: string[]): boolean => {
      if (!primaryRole) return false;
      return actions.every(action => hasPermission(primaryRole, additionalRoles, resource, action));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryRole, additionalRolesKey]);

  return { can, canAny, canAll, RBAC_PERMISSIONS };
}
