import React, { useState, useEffect } from 'react';
import { folderApi } from '../lib/api';
import { X, Search, UserPlus, Trash2, Shield } from 'lucide-react';
import { Button } from './ui/Button';
import { formatDate } from '../lib/utils';

interface FolderAccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  folderName: string;
}

interface Permission {
  id: string;
  grantee_id: string;
  username: string;
  email: string;
  user_role: string;
  permission_type: string;
  granted_by_username: string | null;
  granted_by_folder_owner: boolean;
  created_at: string;
  expires_at: string | null;
}

interface UserSearchResult {
  id: string;
  username: string;
  email: string;
  role: string;
}

export function FolderAccessDialog({
  isOpen,
  onClose,
  folderId,
  folderName
}: FolderAccessDialogProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [permissionType, setPermissionType] = useState<'view' | 'edit' | 'delete'>('view');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPermissions();
    }
  }, [isOpen, folderId]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const response = await folderApi.getPermissions(folderId);
      setPermissions(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    try {
      setSearching(true);
      const response = await folderApi.searchUsers(searchQuery);
      setSearchResults(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to search users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      await folderApi.grantAccess(folderId, {
        userId: selectedUser.id,
        permissionType
      });
      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      await fetchPermissions();
      alert('Access granted successfully');
    } catch (error: any) {
      console.error('Failed to grant access:', error);
      alert(error.response?.data?.error || 'Failed to grant access');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (permissionId: string) => {
    if (!confirm('Are you sure you want to revoke this access?')) return;

    try {
      await folderApi.revokeAccess(folderId, permissionId);
      await fetchPermissions();
      alert('Access revoked successfully');
    } catch (error: any) {
      console.error('Failed to revoke access:', error);
      alert(error.response?.data?.error || 'Failed to revoke access');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Manage Folder Access</h2>
            <p className="text-sm text-muted-foreground mt-1">{folderName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Grant Access Section */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Grant Access to User
            </h3>

            {/* User Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name or email..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && !selectedUser && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUser(user);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b last:border-b-0"
                  >
                    <div className="font-medium">{user.username}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                    <div className="text-xs text-muted-foreground mt-1">Role: {user.role}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected User */}
            {selectedUser && (
              <div className="border rounded-lg p-4 bg-accent/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{selectedUser.username}</div>
                    <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-1 hover:bg-accent rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Permission Type Selector */}
                <div>
                  <label className="block text-sm font-medium mb-2">Permission Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['view', 'edit', 'delete'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setPermissionType(type)}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          permissionType === type
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-accent'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleGrantAccess}
                  disabled={loading}
                  className="w-full"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {loading ? 'Granting Access...' : 'Grant Access'}
                </Button>
              </div>
            )}
          </div>

          {/* Current Permissions Section */}
          <div className="space-y-3">
            <h3 className="font-medium">Current Access ({permissions.length})</h3>

            {loading && permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading permissions...</p>
            ) : permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users have access to this folder yet.</p>
            ) : (
              <div className="space-y-2">
                {permissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{permission.username}</div>
                      <div className="text-sm text-muted-foreground">{permission.email}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                          {permission.permission_type}
                        </span>
                        {permission.granted_by_folder_owner && (
                          <span className="text-xs text-muted-foreground">
                            (granted by owner)
                          </span>
                        )}
                        {permission.granted_by_username && (
                          <span className="text-xs text-muted-foreground">
                            by {permission.granted_by_username}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Granted {formatDate(permission.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeAccess(permission.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 transition-colors"
                      title="Revoke access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
