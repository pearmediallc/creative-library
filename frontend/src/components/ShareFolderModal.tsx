import React, { useState, useEffect } from 'react';
import { X, Users, Share2, Check } from 'lucide-react';
import { teamApi, permissionApi } from '../lib/api';

interface Team {
  id: string;
  name: string;
  description?: string;
  owner_name?: string;
  member_count?: number;
}

interface ShareFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  folderName: string;
  onSuccess?: () => void;
}

export function ShareFolderModal({
  isOpen,
  onClose,
  folderId,
  folderName,
  onSuccess
}: ShareFolderModalProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['view']);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchTeams();
    }
  }, [isOpen]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await teamApi.getAll();
      setTeams(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch teams:', err);
      setError('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permission: string) => {
    setPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const handleShare = async () => {
    if (!selectedTeamId) {
      setError('Please select a team');
      return;
    }

    if (permissions.length === 0) {
      setError('Please select at least one permission');
      return;
    }

    try {
      setSharing(true);
      setError('');

      await permissionApi.shareFolder({
        folder_id: folderId,
        team_id: selectedTeamId,
        permissions
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to share folder:', err);
      setError(err.response?.data?.error || 'Failed to share folder');
    } finally {
      setSharing(false);
    }
  };

  if (!isOpen) return null;

  const permissionOptions = [
    { value: 'view', label: 'View', description: 'Can view files in this folder' },
    { value: 'download', label: 'Download', description: 'Can download files from this folder' },
    { value: 'edit', label: 'Edit', description: 'Can edit file metadata' },
    { value: 'delete', label: 'Delete', description: 'Can delete files from this folder' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Share2 className="text-blue-600" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Share Folder</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {folderName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Team Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Users size={16} className="inline mr-2" />
              Select Team
            </label>
            {loading ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Loading teams...</div>
            ) : teams.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                No teams available. Create a team first.
              </div>
            ) : (
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={sharing}
              >
                <option value="">Choose a team...</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.member_count || 0} members)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Permissions
            </label>
            <div className="space-y-3">
              {permissionOptions.map(option => (
                <label
                  key={option.value}
                  className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                >
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={permissions.includes(option.value)}
                      onChange={() => togglePermission(option.value)}
                      disabled={sharing}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {option.label}
                      </span>
                      {permissions.includes(option.value) && (
                        <Check size={14} className="text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {option.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={sharing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={sharing || !selectedTeamId || permissions.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sharing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Share2 size={16} />
                Share Folder
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
