import React, { useState, useEffect, useCallback } from 'react';
import { X, Users, UserPlus, Trash2, Shield, User, Crown } from 'lucide-react';
import { Button } from './ui/Button';
import { teamApi, adminApi } from '../lib/api';

interface TeamMember {
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  added_at: string;
}

interface TeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  isAdmin: boolean; // Whether current user is team admin
}

export function TeamMembersModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  isAdmin
}: TeamMembersModalProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  // Add member form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'member'>('member');

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await teamApi.getById(teamId);
      setMembers(response.data.data.members || []);
    } catch (err: any) {
      console.error('Failed to fetch team members:', err);
      setError(err.response?.data?.error || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const response = await adminApi.getUsers();
      const users = response.data.data || [];
      setAllUsers(users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email
      })));
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTeamData();
      if (isAdmin) {
        fetchAllUsers();
      }
    }
  }, [isOpen, teamId, isAdmin, fetchTeamData, fetchAllUsers]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }

    // Check if already a member
    if (members.some(m => m.user_id === selectedUserId)) {
      setError('This user is already a team member');
      return;
    }

    setAdding(true);
    setError('');

    try {
      await teamApi.addMember(teamId, {
        user_id: selectedUserId,
        role: selectedRole
      });

      // Reset form
      setSelectedUserId('');
      setSelectedRole('member');

      // Refresh member list
      await fetchTeamData();
    } catch (err: any) {
      console.error('Failed to add member:', err);
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Remove ${userName} from this team?`)) return;

    try {
      setError('');
      await teamApi.removeMember(teamId, userId);
      await fetchTeamData();
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Admin';
      case 'member':
        return 'Member';
      default:
        return role;
    }
  };

  const availableUsers = allUsers.filter(
    u => !members.some(m => m.user_id === u.id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Team Members
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{teamName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add Member Section (Admin Only) */}
          {isAdmin && (
            <form onSubmit={handleAddMember} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Add Team Member
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    disabled={adding}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a user...</option>
                    {availableUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'member')}
                    disabled={adding}
                    className="flex-1 h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={adding || !selectedUserId}
                  >
                    {adding ? 'Adding...' : 'Add'}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Members List */}
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading members...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 dark:text-gray-400">No team members yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                {isAdmin ? 'Add members using the form above' : 'Only team admins can add members'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {members.length} {members.length === 1 ? 'Member' : 'Members'}
              </h3>

              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Role Icon */}
                    <div className="flex-shrink-0">
                      {getRoleIcon(member.role)}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {member.user_name}
                        </p>
                        <span className="flex-shrink-0 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {getRoleLabel(member.role)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {member.user_email}
                      </p>
                    </div>
                  </div>

                  {/* Remove Button */}
                  {isAdmin && member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id, member.user_name)}
                      className="flex-shrink-0 p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
