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

  // Role assignment state
  const [showAssignRole, setShowAssignRole] = useState(false);
  const [assignRoleData, setAssignRoleData] = useState({
    userId: '',
    roleName: '',
    scopeType: 'global',
    scopeId: '',
    expiresAt: ''
  });

  // Permission grant state
  const [showGrantPermission, setShowGrantPermission] = useState(false);
  const [grantPermissionData, setGrantPermissionData] = useState({
    userId: '',
    resourceType: 'file_request',
    action: 'view',
    permission: 'allow' as 'allow' | 'deny',
    resourceId: '',
    expiresAt: '',
    reason: ''
  });

  // UI Permission state
  const [showUIPermission, setShowUIPermission] = useState(false);
  const [uiPermissionData, setUIPermissionData] = useState({
    userId: '',
    uiElement: 'dashboard',
    isVisible: true,
    isEnabled: true,
    customLabel: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

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
      await axios.post(
        `${process.env.REACT_APP_API_URL}/rbac/permissions/grant`,
        {
          userId: grantPermissionData.userId,
          resourceType: grantPermissionData.resourceType,
          action: grantPermissionData.action,
          permission: grantPermissionData.permission,
          resourceId: grantPermissionData.resourceId || null,
          expiresAt: grantPermissionData.expiresAt || null,
          reason: grantPermissionData.reason || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Permission granted successfully!');
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
      await axios.post(
        `${process.env.REACT_APP_API_URL}/rbac/ui-permissions`,
        {
          userId: uiPermissionData.userId,
          uiElement: uiPermissionData.uiElement,
          isVisible: uiPermissionData.isVisible,
          isEnabled: uiPermissionData.isEnabled,
          customLabel: uiPermissionData.customLabel || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('UI permission set successfully!');
      setShowUIPermission(false);
      if (selectedUser) {
        fetchUserPermissions(selectedUser.id);
      }
    } catch (error: any) {
      console.error('Failed to set UI permission:', error);
      alert(error.response?.data?.message || 'Failed to set UI permission');
    }
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
                            }}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Assign Role
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowGrantPermission(true);
                              setGrantPermissionData({ ...grantPermissionData, userId: selectedUser.id });
                            }}
                          >
                            <Shield className="w-4 h-4 mr-2" />
                            Grant Permission
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowUIPermission(true);
                              setUIPermissionData({ ...uiPermissionData, userId: selectedUser.id });
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <Card>
            <CardHeader>
              <CardTitle>Permission Audit Log</CardTitle>
              <CardDescription>Track all permission changes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                Audit log coming soon...
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Assign Role Modal */}
      {showAssignRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Assign Role</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={assignRoleData.roleName}
                  onChange={(e) => setAssignRoleData({ ...assignRoleData, roleName: e.target.value })}
                >
                  <option value="">Select role...</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Scope Type</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={assignRoleData.scopeType}
                  onChange={(e) => setAssignRoleData({ ...assignRoleData, scopeType: e.target.value })}
                >
                  <option value="global">Global</option>
                  <option value="folder">Folder</option>
                  <option value="request">Request</option>
                </select>
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
                <Button variant="outline" onClick={() => setShowAssignRole(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssignRole}>
                  Assign Role
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grant Permission Modal */}
      {showGrantPermission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Grant Permission</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Resource Type</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={grantPermissionData.resourceType}
                  onChange={(e) => setGrantPermissionData({ ...grantPermissionData, resourceType: e.target.value })}
                >
                  <option value="file_request">File Request</option>
                  <option value="folder">Folder</option>
                  <option value="media_file">Media File</option>
                  <option value="canvas">Canvas</option>
                  <option value="analytics">Analytics</option>
                  <option value="user">User Management</option>
                  <option value="admin_panel">Admin Panel</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Action</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={grantPermissionData.action}
                  onChange={(e) => setGrantPermissionData({ ...grantPermissionData, action: e.target.value })}
                >
                  <option value="view">View</option>
                  <option value="create">Create</option>
                  <option value="edit">Edit</option>
                  <option value="delete">Delete</option>
                  <option value="assign">Assign</option>
                  <option value="upload">Upload</option>
                  <option value="download">Download</option>
                  <option value="share">Share</option>
                  <option value="manage">Manage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Permission</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={grantPermissionData.permission}
                  onChange={(e) => setGrantPermissionData({ ...grantPermissionData, permission: e.target.value as 'allow' | 'deny' })}
                >
                  <option value="allow">Allow</option>
                  <option value="deny">Deny</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Resource ID (optional)</label>
                <Input
                  placeholder="Leave empty for all resources..."
                  value={grantPermissionData.resourceId}
                  onChange={(e) => setGrantPermissionData({ ...grantPermissionData, resourceId: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <Input
                  placeholder="Why is this permission being granted?"
                  value={grantPermissionData.reason}
                  onChange={(e) => setGrantPermissionData({ ...grantPermissionData, reason: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expires At (optional)</label>
                <Input
                  type="datetime-local"
                  value={grantPermissionData.expiresAt}
                  onChange={(e) => setGrantPermissionData({ ...grantPermissionData, expiresAt: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowGrantPermission(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGrantPermission}>
                  Grant Permission
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UI Permission Modal */}
      {showUIPermission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Set UI Permission</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">UI Element</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={uiPermissionData.uiElement}
                  onChange={(e) => setUIPermissionData({ ...uiPermissionData, uiElement: e.target.value })}
                >
                  <option value="dashboard">Dashboard</option>
                  <option value="file_requests">File Requests</option>
                  <option value="media_library">Media Library</option>
                  <option value="canvas">Canvas</option>
                  <option value="analytics">Analytics</option>
                  <option value="admin_panel">Admin Panel</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={uiPermissionData.isVisible}
                    onChange={(e) => setUIPermissionData({ ...uiPermissionData, isVisible: e.target.checked })}
                  />
                  <span className="text-sm">Visible</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={uiPermissionData.isEnabled}
                    onChange={(e) => setUIPermissionData({ ...uiPermissionData, isEnabled: e.target.checked })}
                  />
                  <span className="text-sm">Enabled</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Custom Label (optional)</label>
                <Input
                  placeholder="Custom display name..."
                  value={uiPermissionData.customLabel}
                  onChange={(e) => setUIPermissionData({ ...uiPermissionData, customLabel: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowUIPermission(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSetUIPermission}>
                  Set Permission
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
