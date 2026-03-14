import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import axios from 'axios';
import {
  Shield,
  Users,
  Folder,
  Eye,
  EyeOff,
  UserPlus,
  UserMinus,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter
} from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description: string;
  is_system_role: boolean;
}

interface UserPermissions {
  id: string;
  name: string;
  email: string;
  legacy_role: string;
  roles: Array<{
    role_name: string;
    scope_type: string;
    scope_id: string | null;
    expires_at: string | null;
  }>;
  folder_admin_count: number;
}

interface Permission {
  resource_type: string;
  resource_id: string | null;
  action: string;
  permission: 'allow' | 'deny';
  expires_at: string | null;
  reason: string | null;
}

export function RBACAdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'audit'>('users');
  const [users, setUsers] = useState<UserPermissions[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserPermissions | null>(null);
  const [userDetailPermissions, setUserDetailPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Role assignment state
  const [showAssignRole, setShowAssignRole] = useState(false);
  const [assignRoleData, setAssignRoleData] = useState({
    userId: '',
    roleName: '',
    scopeType: 'global',
    scopeId: '',
    expiresAt: ''
  });

  // Permission grant state - tree structure with multi-action per resource
  const [showGrantPermission, setShowGrantPermission] = useState(false);
  const [grantPermissionData, setGrantPermissionData] = useState({
    userId: '',
    // Map of resourceType -> Set of selected actions
    selectedPermissions: {} as Record<string, Set<string>>,
    expandedResources: new Set<string>(),
    permission: 'allow' as 'allow' | 'deny',
    resourceId: '',
    expiresAt: '',
    reason: ''
  });

  // UI Permission state - matrix table for all elements
  const [showUIPermission, setShowUIPermission] = useState(false);
  const [uiPermissionMatrix, setUIPermissionMatrix] = useState<Record<string, { isVisible: boolean; isEnabled: boolean; customLabel: string }>>({});
  const UI_ELEMENTS = [
    'dashboard', 'media_library', 'file_requests', 'launch_requests', 'starred', 'recents',
    'shared_with_me', 'trash', 'shared_by_you', 'teams', 'settings', 'access_requests',
    'canvas', 'analytics', 'admin_panel', 'editors', 'workload', 'metadata_extraction',
    'rbac_permissions', 'activity_logs', 'log_exports', 'faq_help', 'collections'
  ];

  // Resource types and their actions for tree structure
  const RESOURCE_ACTION_MAP: Record<string, string[]> = {
    file_request: ['view', 'create', 'edit', 'delete', 'assign', 'upload', 'download', 'share', 'reassign', 'duplicate', 'close', 'launch', 'reopen'],
    folder: ['view', 'create', 'edit', 'delete', 'share', 'rename', 'move', 'copy'],
    media_file: ['view', 'upload', 'download', 'edit', 'delete', 'share', 'move', 'copy', 'bulk_edit', 'bulk_delete', 'bulk_download'],
    canvas: ['view', 'create', 'edit', 'delete', 'share'],
    analytics: ['view', 'manage'],
    user: ['view', 'create', 'edit', 'delete', 'assign_roles'],
    admin_panel: ['view', 'manage'],
    teams: ['view', 'create', 'edit', 'delete', 'manage_members'],
    workload: ['view', 'manage_capacity'],
    editors: ['view', 'manage'],
    collections: ['view', 'create', 'edit', 'delete'],
    launch_request: ['view', 'create', 'edit', 'delete', 'launch', 'close'],
  };

  // Role assignment - multi-select
  const [assignRoleSelections, setAssignRoleSelections] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const [usersRes, rolesRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/rbac/users`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${process.env.REACT_APP_API_URL}/rbac/roles`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setUsers(usersRes.data.data || []);
      setRoles(rolesRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch RBAC data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/rbac/users/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUserDetailPermissions(response.data.data);
    } catch (error) {
      console.error('Failed to fetch user permissions:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/rbac/audit-log`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAuditLogs(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleAssignRole = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/rbac/roles/assign`,
        {
          userId: assignRoleData.userId,
          roleName: assignRoleData.roleName,
          scopeType: assignRoleData.scopeType,
          scopeId: assignRoleData.scopeId || null,
          expiresAt: assignRoleData.expiresAt || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Role assigned successfully!');
      setShowAssignRole(false);
      fetchData();
      if (selectedUser) {
        fetchUserPermissions(selectedUser.id);
      }
    } catch (error: any) {
      console.error('Failed to assign role:', error);
      alert(error.response?.data?.message || 'Failed to assign role');
    }
  };

  const handleRemoveRole = async (userId: string, roleName: string) => {
    if (!window.confirm(`Remove role "${roleName}" from this user?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/rbac/roles/remove`,
        { userId, roleName },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Role removed successfully!');
      fetchData();
      if (selectedUser) {
        fetchUserPermissions(selectedUser.id);
      }
    } catch (error: any) {
      console.error('Failed to remove role:', error);
      alert(error.response?.data?.message || 'Failed to remove role');
    }
  };

  const handleGrantPermission = async () => {
    try {
      const token = localStorage.getItem('token');
      const promises: Promise<any>[] = [];

      // Batch: for each resource type with selected actions, grant all actions
      for (const [resourceType, actions] of Object.entries(grantPermissionData.selectedPermissions)) {
        const actionsArray = Array.from(actions);
        for (const action of actionsArray) {
          promises.push(
            axios.post(
              `${process.env.REACT_APP_API_URL}/rbac/permissions/grant`,
              {
                userId: grantPermissionData.userId,
                resourceType,
                action,
                permission: grantPermissionData.permission,
                resourceId: grantPermissionData.resourceId || null,
                expiresAt: grantPermissionData.expiresAt || null,
                reason: grantPermissionData.reason || null
              },
              { headers: { Authorization: `Bearer ${token}` } }
            )
          );
        }
      }

      if (promises.length === 0) {
        alert('Please select at least one permission to grant');
        return;
      }

      await Promise.all(promises);
      alert(`${promises.length} permission(s) granted successfully!`);
      setShowGrantPermission(false);
      if (selectedUser) {
        fetchUserPermissions(selectedUser.id);
      }
    } catch (error: any) {
      console.error('Failed to grant permission:', error);
      alert(error.response?.data?.message || 'Failed to grant permission');
    }
  };

  const handleSetUIPermission = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = selectedUser?.id;
      if (!userId) return;

      const promises = Object.entries(uiPermissionMatrix).map(([uiElement, settings]) =>
        axios.post(
          `${process.env.REACT_APP_API_URL}/rbac/ui-permissions`,
          {
            userId,
            uiElement,
            isVisible: settings.isVisible,
            isEnabled: settings.isEnabled,
            customLabel: settings.customLabel || null
          },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );

      await Promise.all(promises);
      alert('UI permissions saved successfully!');
      setShowUIPermission(false);
      if (selectedUser) {
        fetchUserPermissions(selectedUser.id);
      }
    } catch (error: any) {
      console.error('Failed to set UI permission:', error);
      alert(error.response?.data?.message || 'Failed to set UI permission');
    }
  };

  // Handle multi-role assignment
  const handleAssignMultipleRoles = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = assignRoleData.userId;
      const promises = Array.from(assignRoleSelections).map(roleName =>
        axios.post(
          `${process.env.REACT_APP_API_URL}/rbac/roles/assign`,
          {
            userId,
            roleName,
            scopeType: assignRoleData.scopeType,
            scopeId: assignRoleData.scopeId || null,
            expiresAt: assignRoleData.expiresAt || null
          },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );

      if (promises.length === 0) {
        alert('Please select at least one role');
        return;
      }

      await Promise.all(promises);
      alert(`${promises.length} role(s) assigned successfully!`);
      setShowAssignRole(false);
      setAssignRoleSelections(new Set());
      fetchData();
      if (selectedUser) {
        fetchUserPermissions(selectedUser.id);
      }
    } catch (error: any) {
      console.error('Failed to assign roles:', error);
      alert(error.response?.data?.message || 'Failed to assign roles');
    }
  };

  // Initialize UI permission matrix when opening modal
  const initUIPermissionMatrix = () => {
    const matrix: Record<string, { isVisible: boolean; isEnabled: boolean; customLabel: string }> = {};
    const existingPerms = userDetailPermissions?.ui_permissions || [];
    UI_ELEMENTS.forEach(el => {
      const existing = existingPerms.find((p: any) => p.ui_element === el);
      matrix[el] = {
        isVisible: existing ? existing.is_visible : true,
        isEnabled: existing ? existing.is_enabled : true,
        customLabel: existing?.custom_label || ''
      };
    });
    setUIPermissionMatrix(matrix);
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="w-8 h-8 text-blue-600" />
              RBAC Admin Panel
            </h1>
            <p className="text-gray-600 mt-1">
              Manage user roles, permissions, and access control
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Users & Permissions
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'roles'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              Roles
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'audit'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Audit Log
            </button>
          </nav>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Users List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>Select a user to manage permissions</CardDescription>
                  <div className="mt-4 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent className="max-h-[600px] overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUser(user);
                            fetchUserPermissions(user.id);
                          }}
                          className={`w-full text-left p-4 rounded-lg border transition-colors ${
                            selectedUser?.id === user.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {user.legacy_role}
                            </span>
                            {user.roles && user.roles.length > 0 && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                {user.roles.length} role{user.roles.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {user.folder_admin_count > 0 && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded flex items-center gap-1">
                                <Folder className="w-3 h-3" />
                                {user.folder_admin_count}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* User Details */}
            <div className="lg:col-span-2">
              {selectedUser ? (
                <div className="space-y-6">
                  {/* User Info Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{selectedUser.name}</CardTitle>
                          <CardDescription>{selectedUser.email}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setShowAssignRole(true);
                              setAssignRoleData({ ...assignRoleData, userId: selectedUser.id });
                              // Pre-populate currently assigned roles
                              const currentRoles = userDetailPermissions?.roles || [];
                              setAssignRoleSelections(new Set(currentRoles.map((r: any) => r.role_name)));
                            }}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Assign Role
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Pre-populate existing permissions + role default permissions
                              const existingPerms = userDetailPermissions?.permissions || [];
                              const roleDefaults = userDetailPermissions?.roleDefaultPermissions || [];
                              const permMap: Record<string, Set<string>> = {};
                              // Add explicit permissions
                              existingPerms.forEach((p: any) => {
                                if (p.permission === 'allow') {
                                  if (!permMap[p.resource_type]) {
                                    permMap[p.resource_type] = new Set();
                                  }
                                  permMap[p.resource_type].add(p.action);
                                }
                              });
                              // Add role-based default permissions (from primary + additional roles)
                              roleDefaults.forEach((p: any) => {
                                if (p.permission === 'allow') {
                                  if (!permMap[p.resource_type]) {
                                    permMap[p.resource_type] = new Set();
                                  }
                                  permMap[p.resource_type].add(p.action);
                                }
                              });
                              setShowGrantPermission(true);
                              // All sections start collapsed (accordion style)
                              setGrantPermissionData({ ...grantPermissionData, userId: selectedUser.id, selectedPermissions: permMap, expandedResources: new Set<string>() });
                            }}
                          >
                            <Shield className="w-4 h-4 mr-2" />
                            Grant Permission
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              initUIPermissionMatrix();
                              setShowUIPermission(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            UI Permissions
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Roles Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Assigned Roles</CardTitle>
                      <CardDescription>Roles that grant this user permissions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {userDetailPermissions?.roles && userDetailPermissions.roles.length > 0 ? (
                        <div className="space-y-3">
                          {userDetailPermissions.roles.map((role: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <div className="font-medium">{role.role_name}</div>
                                <div className="text-sm text-gray-600">
                                  Scope: {role.scope_type}
                                  {role.scope_id && ` (${role.scope_id.substring(0, 8)}...)`}
                                </div>
                                {role.expires_at && (
                                  <div className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                                    <Clock className="w-3 h-3" />
                                    Expires: {new Date(role.expires_at).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveRole(selectedUser.id, role.role_name)}
                              >
                                <UserMinus className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No roles assigned
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Explicit Permissions Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Explicit Permissions</CardTitle>
                      <CardDescription>Direct permission grants or denies</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {userDetailPermissions?.permissions && userDetailPermissions.permissions.length > 0 ? (
                        <div className="space-y-2">
                          {userDetailPermissions.permissions.map((perm: Permission, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  {perm.permission === 'allow' ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-600" />
                                  )}
                                  <span className="font-medium">
                                    {perm.action} on {perm.resource_type}
                                  </span>
                                </div>
                                {perm.reason && (
                                  <div className="text-sm text-gray-600 mt-1">
                                    Reason: {perm.reason}
                                  </div>
                                )}
                                {perm.expires_at && (
                                  <div className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                                    <Clock className="w-3 h-3" />
                                    Expires: {new Date(perm.expires_at).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No explicit permissions
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Folder Admin Assignments Card */}
                  {userDetailPermissions?.folderAdmin && userDetailPermissions.folderAdmin.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Folder Admin Assignments</CardTitle>
                        <CardDescription>Folders this user administers</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {userDetailPermissions.folderAdmin.map((folder: any, idx: number) => (
                            <div key={idx} className="p-3 border rounded-lg">
                              <div className="font-medium flex items-center gap-2">
                                <Folder className="w-4 h-4" />
                                {folder.folder_name}
                              </div>
                              <div className="text-sm text-gray-600 mt-2 flex flex-wrap gap-2">
                                {folder.can_grant_access && (
                                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                                    Grant Access
                                  </span>
                                )}
                                {folder.can_revoke_access && (
                                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">
                                    Revoke Access
                                  </span>
                                )}
                                {folder.can_manage_requests && (
                                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                                    Manage Requests
                                  </span>
                                )}
                                {folder.can_delete_files && (
                                  <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">
                                    Delete Files
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center text-gray-500">
                    Select a user from the list to view and manage their permissions
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">System Roles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {roles.map((role) => (
                <Card key={role.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-600" />
                      {role.name}
                    </CardTitle>
                    {role.is_system_role && (
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">System Role</span>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm">{role.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <h3 className="text-lg font-semibold mb-4">Application Roles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { name: 'CEO', key: 'ceo', description: 'Full administrative access with all permissions' },
                { name: 'Head of Media Buying', key: 'head_media_buying', description: 'Full administrative access to media buying operations' },
                { name: 'Creative Head', key: 'creative_head', description: 'Full administrative access to creative operations' },
                { name: 'Buyer', key: 'buyer', description: 'Can create file requests and view assigned files' },
                { name: 'Creative', key: 'creative', description: 'Can upload files and manage assigned work' },
                { name: 'Vertical Head', key: 'vertical_head', description: 'Manages verticals and oversees file requests' },
                { name: 'Team Lead', key: 'team_lead', description: 'Manages team file requests across all verticals and analytics for assigned verticals' },
                { name: 'Assistant Team Lead', key: 'assistant_team_lead', description: 'File requests and editor view across all verticals' },
              ].map((role) => (
                <Card key={role.key}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-purple-600" />
                      {role.name}
                    </CardTitle>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">App Role</span>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm">{role.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <Card>
            <CardHeader>
              <CardTitle>Permission Audit Log</CardTitle>
              <CardDescription>Track all permission changes</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="text-center py-8 text-gray-500">Loading audit logs...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No audit logs found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium text-gray-700">Timestamp</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-700">Action</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-700">User</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-700">Target User</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-700">Details</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-700">Resource</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log, index) => (
                        <tr key={log.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="p-3 text-sm text-gray-600">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              (log.action_type === 'grant_permission' || log.action_type === 'permission_granted') ? 'bg-green-100 text-green-800' :
                              (log.action_type === 'revoke_permission' || log.action_type === 'permission_revoked') ? 'bg-red-100 text-red-800' :
                              (log.action_type === 'assign_role' || log.action_type === 'role_assigned') ? 'bg-blue-100 text-blue-800' :
                              (log.action_type === 'remove_role' || log.action_type === 'role_revoked') ? 'bg-orange-100 text-orange-800' :
                              log.action_type === 'folder_admin_added' ? 'bg-purple-100 text-purple-800' :
                              log.action_type === 'folder_admin_removed' ? 'bg-yellow-100 text-yellow-800' :
                              log.action_type === 'ui_permission_set' ? 'bg-indigo-100 text-indigo-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {log.action_type.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-gray-900">{log.performed_by_name || 'Unknown'}</td>
                          <td className="p-3 text-sm text-gray-900">{log.target_user_name || '-'}</td>
                          <td className="p-3 text-sm text-gray-600">
                            {log.role_name && <div>Role: {log.role_name}</div>}
                            {log.permission_action && <div>Action: {log.permission_action}</div>}
                            {log.scope_type && <div>Scope: {log.scope_type}</div>}
                          </td>
                          <td className="p-3 text-sm text-gray-600">
                            {log.resource_type ? `${log.resource_type}${log.resource_id ? ` (${log.resource_id.substring(0, 8)}...)` : ''}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Assign Role Modal - Multi-select checkboxes */}
      {showAssignRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Assign Roles</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Roles (multi-select)</label>
                <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-2 bg-gray-50">
                  {/* System roles from DB */}
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1.5 rounded">
                      <input
                        type="checkbox"
                        checked={assignRoleSelections.has(role.name)}
                        onChange={() => {
                          setAssignRoleSelections(prev => {
                            const next = new Set(prev);
                            if (next.has(role.name)) next.delete(role.name);
                            else next.add(role.name);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span className="text-sm">{role.name}</span>
                      {role.is_system_role && <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">System</span>}
                    </label>
                  ))}
                  {/* Application roles */}
                  {['admin', 'ceo', 'head_media_buying', 'creative_head', 'buyer', 'creative', 'vertical_head', 'team_lead', 'assistant_team_lead'].filter(
                    r => !roles.some(dbRole => dbRole.name.toLowerCase().replace(/\s+/g, '_') === r)
                  ).map(roleName => (
                    <label key={roleName} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1.5 rounded">
                      <input
                        type="checkbox"
                        checked={assignRoleSelections.has(roleName)}
                        onChange={() => {
                          setAssignRoleSelections(prev => {
                            const next = new Set(prev);
                            if (next.has(roleName)) next.delete(roleName);
                            else next.add(roleName);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span className="text-sm">{roleName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">App Role</span>
                    </label>
                  ))}
                </div>
                {assignRoleSelections.size > 0 && (
                  <p className="text-xs text-blue-600 mt-1">{assignRoleSelections.size} role(s) selected</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Scope Type</label>
                <div className="flex gap-3">
                  {['global', 'folder', 'request'].map(scope => (
                    <label key={scope} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="scopeType" value={scope}
                        checked={assignRoleData.scopeType === scope}
                        onChange={(e) => setAssignRoleData({ ...assignRoleData, scopeType: e.target.value })}
                        className="w-4 h-4 text-blue-600" />
                      <span className="text-sm capitalize">{scope}</span>
                    </label>
                  ))}
                </div>
              </div>
              {assignRoleData.scopeType !== 'global' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Scope ID (optional)</label>
                  <Input
                    placeholder="Enter folder or request ID..."
                    value={assignRoleData.scopeId}
                    onChange={(e) => setAssignRoleData({ ...assignRoleData, scopeId: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Expires At (optional)</label>
                <Input
                  type="datetime-local"
                  value={assignRoleData.expiresAt}
                  onChange={(e) => setAssignRoleData({ ...assignRoleData, expiresAt: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowAssignRole(false); setAssignRoleSelections(new Set()); }}>
                  Cancel
                </Button>
                <Button onClick={handleAssignMultipleRoles} disabled={assignRoleSelections.size === 0}>
                  Assign {assignRoleSelections.size} Role(s)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grant Permission Modal - Tree Structure */}
      {showGrantPermission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Grant Permission</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Permission Tree (click to expand, check actions)</label>
                <div className="border rounded-lg bg-gray-50 max-h-72 overflow-y-auto">
                  {Object.entries(RESOURCE_ACTION_MAP).map(([resourceType, actions]) => {
                    const isExpanded = grantPermissionData.expandedResources.has(resourceType);
                    const selectedActions = grantPermissionData.selectedPermissions[resourceType] || new Set<string>();
                    const allChecked = actions.every(a => selectedActions.has(a));
                    const someChecked = actions.some(a => selectedActions.has(a));

                    return (
                      <div key={resourceType} className="border-b last:border-b-0">
                        <div
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white"
                          onClick={() => {
                            setGrantPermissionData(prev => {
                              const next = new Set(prev.expandedResources);
                              if (next.has(resourceType)) next.delete(resourceType);
                              else next.add(resourceType);
                              return { ...prev, expandedResources: next };
                            });
                          }}
                        >
                          <span className="text-gray-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                            onChange={(e) => {
                              e.stopPropagation();
                              setGrantPermissionData(prev => {
                                const newPerms = { ...prev.selectedPermissions };
                                if (allChecked) {
                                  delete newPerms[resourceType];
                                } else {
                                  newPerms[resourceType] = new Set(actions);
                                }
                                return { ...prev, selectedPermissions: newPerms };
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span className="text-sm font-medium">{resourceType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                          {someChecked && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-auto">
                              {selectedActions.size}/{actions.length}
                            </span>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="pl-10 pr-3 pb-2 grid grid-cols-2 gap-1">
                            {actions.map(action => (
                              <label key={action} className="flex items-center gap-1.5 cursor-pointer hover:bg-white p-1 rounded text-xs">
                                <input
                                  type="checkbox"
                                  checked={selectedActions.has(action)}
                                  onChange={() => {
                                    setGrantPermissionData(prev => {
                                      const newPerms = { ...prev.selectedPermissions };
                                      const set = new Set(newPerms[resourceType] || []);
                                      if (set.has(action)) set.delete(action);
                                      else set.add(action);
                                      if (set.size === 0) delete newPerms[resourceType];
                                      else newPerms[resourceType] = set;
                                      return { ...prev, selectedPermissions: newPerms };
                                    });
                                  }}
                                  className="w-3.5 h-3.5 rounded text-blue-600"
                                />
                                <span>{action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  const totalSelected = Object.values(grantPermissionData.selectedPermissions).reduce((acc, s) => acc + s.size, 0);
                  return totalSelected > 0 ? (
                    <p className="text-xs text-blue-600 mt-1">{totalSelected} permission(s) selected across {Object.keys(grantPermissionData.selectedPermissions).length} resource(s)</p>
                  ) : null;
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Permission Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="permType" value="allow"
                      checked={grantPermissionData.permission === 'allow'}
                      onChange={() => setGrantPermissionData(prev => ({ ...prev, permission: 'allow' }))}
                      className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700">Allow</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="permType" value="deny"
                      checked={grantPermissionData.permission === 'deny'}
                      onChange={() => setGrantPermissionData(prev => ({ ...prev, permission: 'deny' }))}
                      className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700">Deny</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Resource ID (optional)</label>
                <Input
                  placeholder="Leave empty for all resources..."
                  value={grantPermissionData.resourceId}
                  onChange={(e) => setGrantPermissionData(prev => ({ ...prev, resourceId: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <Input
                  placeholder="Why is this permission being granted?"
                  value={grantPermissionData.reason}
                  onChange={(e) => setGrantPermissionData(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expires At (optional)</label>
                <Input
                  type="datetime-local"
                  value={grantPermissionData.expiresAt}
                  onChange={(e) => setGrantPermissionData(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowGrantPermission(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGrantPermission}>
                  Grant Permissions
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UI Permission Modal - Matrix Table */}
      {showUIPermission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-1">UI Permissions Matrix</h3>
            <p className="text-sm text-gray-500 mb-4">Toggle visibility and access for {selectedUser?.name}</p>
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left px-3 py-2 font-medium">UI Element</th>
                      <th className="text-center px-3 py-2 font-medium w-20">Visible</th>
                      <th className="text-center px-3 py-2 font-medium w-20">Enabled</th>
                      <th className="text-left px-3 py-2 font-medium w-40">Custom Label</th>
                    </tr>
                  </thead>
                  <tbody>
                    {UI_ELEMENTS.map((el, idx) => {
                      const settings = uiPermissionMatrix[el] || { isVisible: true, isEnabled: true, customLabel: '' };
                      return (
                        <tr key={el} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-1.5 text-xs font-medium text-gray-700">
                            {el.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </td>
                          <td className="text-center px-3 py-1.5">
                            <input
                              type="checkbox"
                              checked={settings.isVisible}
                              onChange={(e) => {
                                setUIPermissionMatrix(prev => ({
                                  ...prev,
                                  [el]: { ...prev[el], isVisible: e.target.checked }
                                }));
                              }}
                              className="w-4 h-4 rounded text-blue-600"
                            />
                          </td>
                          <td className="text-center px-3 py-1.5">
                            <input
                              type="checkbox"
                              checked={settings.isEnabled}
                              onChange={(e) => {
                                setUIPermissionMatrix(prev => ({
                                  ...prev,
                                  [el]: { ...prev[el], isEnabled: e.target.checked }
                                }));
                              }}
                              className="w-4 h-4 rounded text-green-600"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={settings.customLabel}
                              onChange={(e) => {
                                setUIPermissionMatrix(prev => ({
                                  ...prev,
                                  [el]: { ...prev[el], customLabel: e.target.value }
                                }));
                              }}
                              placeholder="Custom name..."
                              className="w-full text-xs px-2 py-1 border rounded bg-white"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allVisible: Record<string, any> = {};
                      UI_ELEMENTS.forEach(el => {
                        allVisible[el] = { ...uiPermissionMatrix[el], isVisible: true, isEnabled: true };
                      });
                      setUIPermissionMatrix(allVisible);
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Enable All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const allHidden: Record<string, any> = {};
                      UI_ELEMENTS.forEach(el => {
                        allHidden[el] = { ...uiPermissionMatrix[el], isVisible: false, isEnabled: false };
                      });
                      setUIPermissionMatrix(allHidden);
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Disable All
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowUIPermission(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSetUIPermission}>
                    Save All Permissions
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
