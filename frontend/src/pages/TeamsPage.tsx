import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TeamMembersModal } from '../components/TeamMembersModal';
import { teamApi, adminApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, Trash2, UserPlus, Search, X as XIcon, Shield, User } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  owner_name?: string;
  member_count?: number;
  created_at: string;
}

export function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [membersModalTeam, setMembersModalTeam] = useState<{ id: string; name: string; isAdmin: boolean } | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await teamApi.getAll();
      setTeams(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (name: string, description: string, members: Array<{ userId: string; role: string }>) => {
    try {
      // First, create the team
      const response = await teamApi.create({ name, description });
      const teamId = response.data.data.id;

      // Then add members if any were selected
      if (members.length > 0) {
        await Promise.all(
          members.map(member =>
            teamApi.addMember(teamId, { userId: member.userId, teamRole: member.role as 'lead' | 'member' | 'guest' })
          )
        );
      }

      setShowCreateModal(false);
      fetchTeams();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create team');
      throw error;
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Delete team "${teamName}"?`)) return;

    try {
      await teamApi.delete(teamId);
      // Close the members modal if it's open for this team
      if (membersModalTeam?.id === teamId) {
        setMembersModalTeam(null);
      }
      fetchTeams();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete team');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Teams</h1>
            <p className="text-muted-foreground">Manage teams for collaborative file sharing</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={16} className="mr-2" />
            Create Team
          </Button>
        </div>

        {/* Teams Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading teams...</p>
          </div>
        ) : teams.length === 0 ? (
          <Card className="p-12 text-center">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a team to collaborate and share folders with multiple users
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={16} className="mr-2" />
              Create Your First Team
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map(team => (
              <Card key={team.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <Users size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{team.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {team.member_count || 0} members
                      </p>
                    </div>
                  </div>
                </div>

                {team.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {team.description}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setMembersModalTeam({
                      id: team.id,
                      name: team.name,
                      isAdmin: user?.id === team.owner_id || user?.role === 'admin'
                    })}
                  >
                    <UserPlus size={14} className="mr-1" />
                    Members
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTeam(team.id, team.name)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create Team Modal */}
        {showCreateModal && (
          <CreateTeamModal
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateTeam}
          />
        )}

        {/* Team Members Modal */}
        {membersModalTeam && (
          <TeamMembersModal
            isOpen={true}
            onClose={() => setMembersModalTeam(null)}
            teamId={membersModalTeam.id}
            teamName={membersModalTeam.name}
            isAdmin={membersModalTeam.isAdmin}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

interface SelectedMember {
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

interface AvailableUser {
  id: string;
  name: string;
  email: string;
}

function CreateTeamModal({
  onClose,
  onSubmit
}: {
  onClose: () => void;
  onSubmit: (name: string, description: string, members: Array<{ userId: string; role: string }>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Member selection state
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Fetch available users when modal opens
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await adminApi.getUsers();
        const users = response.data.data || [];
        setAvailableUsers(users.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email
        })));
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSubmitting(true);
      await onSubmit(
        name.trim(),
        description.trim(),
        selectedMembers.map(m => ({ userId: m.userId, role: m.role }))
      );
    } catch (error) {
      console.error('Failed to create team:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMember = (user: AvailableUser) => {
    if (!selectedMembers.find(m => m.userId === user.id)) {
      setSelectedMembers([...selectedMembers, {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: 'member'
      }]);
    }
    setSearchQuery('');
    setShowUserDropdown(false);
  };

  const handleRemoveMember = (userId: string) => {
    setSelectedMembers(selectedMembers.filter(m => m.userId !== userId));
  };

  const handleRoleChange = (userId: string, role: 'admin' | 'member') => {
    setSelectedMembers(selectedMembers.map(m =>
      m.userId === userId ? { ...m, role } : m
    ));
  };

  // Filter users based on search query and exclude already selected
  const filteredUsers = availableUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const notSelected = !selectedMembers.find(m => m.userId === user.id);
    return matchesSearch && notSelected;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold">Create Team</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Create a new team and optionally add members
            </p>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Team Name */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Team Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Marketing Team"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
                disabled={submitting}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={submitting}
              />
            </div>

            {/* Member Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Team Members (Optional)
              </label>

              {/* Search/Add User */}
              <div className="relative mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowUserDropdown(e.target.value.length > 0);
                    }}
                    onFocus={() => searchQuery.length > 0 && setShowUserDropdown(true)}
                    placeholder="Search users by name or email..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={submitting || loadingUsers}
                  />
                </div>

                {/* User Dropdown */}
                {showUserDropdown && searchQuery.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {loadingUsers ? (
                      <div className="p-4 text-sm text-gray-600 dark:text-gray-400 text-center">
                        Loading users...
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-4 text-sm text-gray-600 dark:text-gray-400 text-center">
                        No users found
                      </div>
                    ) : (
                      filteredUsers.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleAddMember(user)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex items-start gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {user.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {user.email}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Members List */}
              {selectedMembers.length > 0 && (
                <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Selected Members ({selectedMembers.length})
                  </div>
                  {selectedMembers.map(member => (
                    <div
                      key={member.userId}
                      className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {member.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {member.email}
                        </div>
                      </div>

                      {/* Role Selector */}
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value as 'admin' | 'member')}
                        disabled={submitting}
                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        disabled={submitting}
                        className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Remove member"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selectedMembers.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  You can add members now or later. Search above to add users.
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || submitting}>
              {submitting ? 'Creating...' : 'Create Team'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
