import React, { useState, useEffect, useCallback } from 'react';
import { X, Share2, Users, Link as LinkIcon, Copy, Check, Mail, Calendar, Eye, Download, Edit, Trash2, User as UserIcon, Lock, Clock, BarChart } from 'lucide-react';
import { Button } from './ui/Button';
import { permissionApi, teamApi, adminApi, publicLinkApi } from '../lib/api';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  resourceType: 'file' | 'folder';
  resourceId: string;
  resourceName: string;
}

interface Permission {
  id: string;
  resource_type: 'file' | 'folder';
  resource_id: string;
  grantee_type: 'user' | 'team';
  grantee_id: string;
  grantee_name: string;
  permission_type: 'view' | 'download' | 'edit' | 'delete';
  granted_at: string;
  expires_at?: string | null;
  is_public_link?: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
}

export function ShareDialog({
  isOpen,
  onClose,
  resourceType,
  resourceId,
  resourceName
}: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState<'people' | 'link'>('people');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Share with people form state
  const [shareType, setShareType] = useState<'user' | 'team'>('user');
  const [selectedId, setSelectedId] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<'view' | 'download' | 'edit' | 'delete'>>(new Set(['view' as const]));
  const [expiresAt, setExpiresAt] = useState('');

  // Link sharing state
  const [publicLink, setPublicLink] = useState<any>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkPassword, setLinkPassword] = useState('');
  const [linkExpires, setLinkExpires] = useState('');
  const [disableDownload, setDisableDownload] = useState(false);
  const [maxViews, setMaxViews] = useState('');
  const [linkStats, setLinkStats] = useState<any>(null);
  const [loadingLink, setLoadingLink] = useState(false);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await permissionApi.getResourcePermissions(resourceType, resourceId);
      const perms = response.data.data || [];
      setPermissions(perms);

      // Find public link if exists
      const publicLinkPerm = perms.find((p: any) => p.is_public_link);
      if (publicLinkPerm) {
        setPublicLink(publicLinkPerm);
        fetchLinkStats(publicLinkPerm.id);
      }
    } catch (err: any) {
      console.error('Failed to fetch permissions:', err);
      setError(err.response?.data?.error || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  const fetchLinkStats = async (linkId: string) => {
    try {
      const response = await publicLinkApi.getStats(linkId);
      setLinkStats(response.data.data);
    } catch (err) {
      console.error('Failed to fetch link stats:', err);
    }
  };

  const fetchUsersAndTeams = useCallback(async () => {
    try {
      const [usersRes, teamsRes] = await Promise.all([
        adminApi.getUsers(),
        teamApi.getAll()
      ]);
      setAllUsers((usersRes.data.data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email
      })));
      setAllTeams((teamsRes.data.data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description
      })));
    } catch (err) {
      console.error('Failed to fetch users/teams:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPermissions();
      fetchUsersAndTeams();
    }
  }, [isOpen, fetchPermissions, fetchUsersAndTeams]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedId) {
      setError(`Please select a ${shareType}`);
      return;
    }

    if (selectedPermissions.size === 0) {
      setError('Please select at least one permission');
      return;
    }

    setSharing(true);
    setError('');
    setSuccess('');

    try {
      // Grant each selected permission
      await Promise.all(
        Array.from(selectedPermissions).map(permType =>
          permissionApi.grant({
            resource_type: resourceType,
            resource_id: resourceId,
            grantee_type: shareType,
            grantee_id: selectedId,
            permission_type: permType,
            expires_at: expiresAt || undefined
          })
        )
      );

      setSuccess(`Shared successfully with ${shareType === 'user' ? 'user' : 'team'}!`);
      setSelectedId('');
      setSelectedPermissions(new Set(['view' as const]));
      setExpiresAt('');
      await fetchPermissions();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Failed to share:', err);
      setError(err.response?.data?.error || 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const handleRevoke = async (permissionId: string, granteeName: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Remove access for ${granteeName}?`)) return;

    try {
      setError('');
      await permissionApi.revoke(permissionId);
      setSuccess('Access removed successfully!');
      await fetchPermissions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Failed to revoke permission:', err);
      setError(err.response?.data?.error || 'Failed to remove access');
    }
  };

  const handleGenerateLink = async () => {
    try {
      setLoadingLink(true);
      setError('');

      // First create a permission if one doesn't exist
      let permId = permissions.find(p => p.resource_type === resourceType && p.resource_id === resourceId)?.id;

      if (!permId) {
        // Create a self-permission first
        const permResponse = await permissionApi.grant({
          resource_type: resourceType,
          resource_id: resourceId,
          grantee_type: 'user',
          grantee_id: 'self',
          permission_type: 'view'
        });
        permId = permResponse.data.data.id;
      }

      // Ensure permId is defined
      if (!permId) {
        throw new Error('Failed to get or create permission');
      }

      // Create public link
      const response = await publicLinkApi.create(permId, {
        password: linkPassword || undefined,
        expires_at: linkExpires || undefined,
        disable_download: disableDownload,
        max_views: maxViews ? parseInt(maxViews) : undefined
      });

      setPublicLink(response.data.data);
      setSuccess('Public link created successfully!');
      await fetchPermissions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Failed to generate link:', err);
      setError(err.response?.data?.error || 'Failed to generate link');
    } finally {
      setLoadingLink(false);
    }
  };

  const handleUpdateLink = async () => {
    if (!publicLink) return;

    try {
      setLoadingLink(true);
      setError('');

      await publicLinkApi.update(publicLink.id, {
        password: linkPassword || undefined,
        expires_at: linkExpires || undefined,
        disable_download: disableDownload,
        max_views: maxViews ? parseInt(maxViews) : undefined
      });

      setSuccess('Link settings updated!');
      await fetchPermissions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Failed to update link:', err);
      setError(err.response?.data?.error || 'Failed to update link');
    } finally {
      setLoadingLink(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!publicLink) return;

    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to revoke this public link? It will no longer be accessible.')) return;

    try {
      setLoadingLink(true);
      setError('');

      await publicLinkApi.revoke(publicLink.id);
      setPublicLink(null);
      setLinkStats(null);
      setLinkPassword('');
      setLinkExpires('');
      setDisableDownload(false);
      setMaxViews('');
      setSuccess('Public link revoked successfully!');
      await fetchPermissions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Failed to revoke link:', err);
      setError(err.response?.data?.error || 'Failed to revoke link');
    } finally {
      setLoadingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!publicLink) return;

    try {
      const link = `${window.location.origin}/s/${publicLink.id}`;
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      setError('Failed to copy link to clipboard');
    }
  };

  const getPermissionIcon = (permType: string) => {
    switch (permType) {
      case 'view':
        return <Eye className="w-4 h-4 text-blue-500" />;
      case 'download':
        return <Download className="w-4 h-4 text-green-500" />;
      case 'edit':
        return <Edit className="w-4 h-4 text-orange-500" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 text-red-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPermissionLabel = (permType: string) => {
    switch (permType) {
      case 'view':
        return 'Can view';
      case 'download':
        return 'Can download';
      case 'edit':
        return 'Can edit';
      case 'delete':
        return 'Can delete';
      default:
        return permType;
    }
  };

  const availableUsers = allUsers.filter(
    u => !permissions.some(p => p.grantee_type === 'user' && p.grantee_id === u.id)
  );

  const availableTeams = allTeams.filter(
    t => !permissions.some(p => p.grantee_type === 'team' && p.grantee_id === t.id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Share {resourceType}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{resourceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          <button
            onClick={() => setActiveTab('people')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'people'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Users className="w-4 h-4 inline-block mr-2" />
            Share with people
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'link'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <LinkIcon className="w-4 h-4 inline-block mr-2" />
            Get link
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Success/Error Messages */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* People Tab */}
          {activeTab === 'people' && (
            <>
              {/* Share Form */}
              <form onSubmit={handleShare} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Add people or teams
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {/* Share Type Selection */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShareType('user'); setSelectedId(''); }}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        shareType === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <UserIcon className="w-4 h-4 inline-block mr-1" />
                      User
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShareType('team'); setSelectedId(''); }}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        shareType === 'team'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <Users className="w-4 h-4 inline-block mr-1" />
                      Team
                    </button>
                  </div>

                  {/* User/Team Selection */}
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    disabled={sharing}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      {shareType === 'user' ? 'Select a user...' : 'Select a team...'}
                    </option>
                    {shareType === 'user'
                      ? availableUsers.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </option>
                        ))
                      : availableTeams.map(team => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))
                    }
                  </select>

                  {/* Permission Selection */}
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
                      Select permissions
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer p-2 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.has('view')}
                          onChange={(e) => {
                            const newPerms = new Set(selectedPermissions);
                            if (e.target.checked) {
                              newPerms.add('view');
                            } else {
                              newPerms.delete('view');
                            }
                            setSelectedPermissions(newPerms);
                          }}
                          disabled={sharing}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Eye className="w-4 h-4 text-blue-500" />
                        Can view
                      </label>

                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer p-2 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.has('download')}
                          onChange={(e) => {
                            const newPerms = new Set(selectedPermissions);
                            if (e.target.checked) {
                              newPerms.add('download');
                            } else {
                              newPerms.delete('download');
                            }
                            setSelectedPermissions(newPerms);
                          }}
                          disabled={sharing}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Download className="w-4 h-4 text-green-500" />
                        Can download
                      </label>

                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer p-2 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.has('edit')}
                          onChange={(e) => {
                            const newPerms = new Set(selectedPermissions);
                            if (e.target.checked) {
                              newPerms.add('edit');
                            } else {
                              newPerms.delete('edit');
                            }
                            setSelectedPermissions(newPerms);
                          }}
                          disabled={sharing}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Edit className="w-4 h-4 text-orange-500" />
                        Can edit
                      </label>

                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer p-2 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.has('delete')}
                          onChange={(e) => {
                            const newPerms = new Set(selectedPermissions);
                            if (e.target.checked) {
                              newPerms.add('delete');
                            } else {
                              newPerms.delete('delete');
                            }
                            setSelectedPermissions(newPerms);
                          }}
                          disabled={sharing}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Trash2 className="w-4 h-4 text-red-500" />
                        Can delete
                      </label>
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      className="w-full"
                      disabled={sharing || !selectedId || selectedPermissions.size === 0}
                    >
                      {sharing ? 'Sharing...' : 'Share'}
                    </Button>
                  </div>

                  {/* Optional: Expiration Date */}
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <Calendar className="w-3 h-3 inline-block mr-1" />
                      Expires at (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      disabled={sharing}
                      className="w-full h-9 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </form>

              {/* Shared With List */}
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
              ) : permissions.length === 0 ? (
                <div className="text-center py-8">
                  <Share2 className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">Not shared with anyone yet</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Share this {resourceType} to collaborate
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {permissions.length} {permissions.length === 1 ? 'Person' : 'People'} with access
                  </h3>

                  {permissions.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Icon */}
                        <div className="flex-shrink-0">
                          {perm.grantee_type === 'team' ? (
                            <Users className="w-4 h-4 text-purple-500" />
                          ) : (
                            <UserIcon className="w-4 h-4 text-blue-500" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {perm.grantee_name}
                            </p>
                            <span className="flex-shrink-0 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-1">
                              {getPermissionIcon(perm.permission_type)}
                              {getPermissionLabel(perm.permission_type)}
                            </span>
                          </div>
                          {perm.expires_at && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Expires: {new Date(perm.expires_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRevoke(perm.id, perm.grantee_name)}
                        className="flex-shrink-0 p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remove access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Link Tab */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              {!publicLink ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <LinkIcon className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Create public link
                    </h3>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Anyone with the link can access this {resourceType}
                  </p>

                  {/* Link Settings */}
                  <div className="space-y-3 mb-4">
                    {/* Password Protection */}
                    <div>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                        <Lock className="w-4 h-4" />
                        Password protection (optional)
                      </label>
                      <input
                        type="password"
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Expiration */}
                    <div>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                        <Clock className="w-4 h-4" />
                        Expiration date (optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={linkExpires}
                        onChange={(e) => setLinkExpires(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Disable Download */}
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={disableDownload}
                        onChange={(e) => setDisableDownload(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Download className="w-4 h-4" />
                      Disable downloads
                    </label>

                    {/* Max Views */}
                    <div>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                        <Eye className="w-4 h-4" />
                        Maximum views (optional)
                      </label>
                      <input
                        type="number"
                        value={maxViews}
                        onChange={(e) => setMaxViews(e.target.value)}
                        placeholder="Unlimited"
                        min="1"
                        className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateLink}
                    className="w-full"
                    disabled={loadingLink}
                  >
                    {loadingLink ? 'Generating...' : (
                      <>
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Generate public link
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Link Display */}
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Check className="w-4 h-4 text-green-600" />
                      <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">
                        Public link active
                      </h3>
                    </div>

                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={`${window.location.origin}/s/${publicLink.id}`}
                        readOnly
                        className="flex-1 h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                      />
                      <Button
                        onClick={handleCopyLink}
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0"
                      >
                        {linkCopied ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Link Stats */}
                    {linkStats && (
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-green-200 dark:border-green-800">
                        <div>
                          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                            <Eye className="w-3 h-3" />
                            Views
                          </div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                            {linkStats.view_count || 0}
                            {linkStats.max_views && ` / ${linkStats.max_views}`}
                          </p>
                        </div>
                        {linkStats.last_viewed_at && (
                          <div>
                            <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                              <Clock className="w-3 h-3" />
                              Last viewed
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                              {new Date(linkStats.last_viewed_at).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Link Settings */}
                  <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Link settings
                    </h4>

                    <div className="space-y-3">
                      {/* Password Protection */}
                      <div>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                          <Lock className="w-4 h-4" />
                          Password protection
                        </label>
                        <input
                          type="password"
                          value={linkPassword}
                          onChange={(e) => setLinkPassword(e.target.value)}
                          placeholder={linkStats?.has_password ? 'Enter new password to change' : 'No password set'}
                          className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                        {linkStats?.has_password && (
                          <p className="text-xs text-gray-500 mt-1">Password is currently set</p>
                        )}
                      </div>

                      {/* Expiration */}
                      <div>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                          <Clock className="w-4 h-4" />
                          Expiration date
                        </label>
                        <input
                          type="datetime-local"
                          value={linkExpires}
                          onChange={(e) => setLinkExpires(e.target.value)}
                          className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                        {linkStats?.expires_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Current expiration: {new Date(linkStats.expires_at).toLocaleString()}
                          </p>
                        )}
                      </div>

                      {/* Disable Download */}
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={disableDownload}
                          onChange={(e) => setDisableDownload(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Download className="w-4 h-4" />
                        Disable downloads
                      </label>

                      {/* Max Views */}
                      <div>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                          <Eye className="w-4 h-4" />
                          Maximum views
                        </label>
                        <input
                          type="number"
                          value={maxViews}
                          onChange={(e) => setMaxViews(e.target.value)}
                          placeholder="Unlimited"
                          min="1"
                          className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={handleUpdateLink}
                        size="sm"
                        className="flex-1"
                        disabled={loadingLink}
                      >
                        {loadingLink ? 'Updating...' : 'Update settings'}
                      </Button>
                      <Button
                        onClick={handleRevokeLink}
                        size="sm"
                        variant="outline"
                        className="flex-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        disabled={loadingLink}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Revoke link
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
