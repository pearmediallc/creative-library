import React, { useState, useEffect } from 'react';
import { X, Folder, Users } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { folderApi, teamApi } from '../lib/api';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentFolderId?: string | null;
  parentFolderName?: string;
}

interface Team {
  id: string;
  name: string;
}

export function CreateFolderModal({
  isOpen,
  onClose,
  onSuccess,
  parentFolderId = null,
  parentFolderName
}: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [ownershipType, setOwnershipType] = useState<'user' | 'team'>('user');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [userTeams, setUserTeams] = useState<Team[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchUserTeams();
    }
  }, [isOpen]);

  const fetchUserTeams = async () => {
    try {
      const response = await teamApi.getUserTeams();
      setUserTeams(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!folderName.trim()) {
      setError('Folder name is required');
      return;
    }

    if (ownershipType === 'team' && !selectedTeamId) {
      setError('Please select a team');
      return;
    }

    setCreating(true);
    setError('');

    try {
      await folderApi.create({
        name: folderName.trim(),
        parent_folder_id: parentFolderId || undefined,
        description: description.trim() || undefined,
        color,
        team_id: ownershipType === 'team' ? selectedTeamId : undefined,
        ownership_type: ownershipType
      });

      // Reset form
      setFolderName('');
      setDescription('');
      setColor('#3b82f6');

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to create folder:', error);
      setError(error.response?.data?.error || 'Failed to create folder');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Create New Folder
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Parent folder info */}
          {parentFolderName && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Creating folder inside: <span className="font-medium">{parentFolderName}</span>
              </p>
            </div>
          )}

          {/* Folder name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Folder Name *
            </label>
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g., Campaign Assets, Q1 2024"
              autoFocus
              disabled={creating}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Ownership Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Folder Ownership
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="user"
                  checked={ownershipType === 'user'}
                  onChange={(e) => setOwnershipType(e.target.value as 'user' | 'team')}
                  disabled={creating}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Personal Folder</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="team"
                  checked={ownershipType === 'team'}
                  onChange={(e) => setOwnershipType(e.target.value as 'user' | 'team')}
                  disabled={creating || userTeams.length === 0}
                  className="w-4 h-4"
                />
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Team Folder</span>
                </div>
              </label>
            </div>
          </div>

          {/* Team Selection */}
          {ownershipType === 'team' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Team *
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                disabled={creating}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Choose a team...</option>
                {userTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {userTeams.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  You need to create a team first to create team folders
                </p>
              )}
            </div>
          )}

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Folder Color
            </label>
            <div className="flex gap-2">
              {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((colorOption) => (
                <button
                  key={colorOption}
                  type="button"
                  onClick={() => setColor(colorOption)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    color === colorOption ? 'border-gray-900 dark:border-white' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: colorOption }}
                />
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creating || !folderName.trim()}
            >
              {creating ? 'Creating...' : 'Create Folder'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
