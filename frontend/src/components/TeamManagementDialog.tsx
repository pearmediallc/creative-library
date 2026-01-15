import React, { useState, useEffect } from 'react';
import { teamApi } from '../lib/api';
import { X, Users, Plus, Trash2, Edit2, UserPlus, Shield } from 'lucide-react';
import { Button } from './ui/Button';

interface Team {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  owner_username?: string;
  member_count?: number;
  folder_count?: number;
  created_at: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  username: string;
  email: string;
  team_role: 'lead' | 'member' | 'guest';
  user_role: string;
  joined_at: string;
}

interface TeamManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamCreated?: (team: Team) => void;
}

export function TeamManagementDialog({ isOpen, onClose, onTeamCreated }: TeamManagementDialogProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');

  // Form states
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchTeams();
    }
  }, [isOpen]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await teamApi.getUserTeams();
      setTeams(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch teams:', error);
      setError(error.response?.data?.error || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamDetails = async (teamId: string) => {
    try {
      setLoading(true);
      const response = await teamApi.getTeam(teamId);
      const teamData = response.data.data;
      setSelectedTeam(teamData);
      setTeamMembers(teamData.members || []);
      setView('detail');
    } catch (error: any) {
      console.error('Failed to fetch team details:', error);
      setError(error.response?.data?.error || 'Failed to load team details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      setError('Team name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await teamApi.createTeam({
        name: teamName.trim(),
        description: teamDescription.trim() || undefined,
      });
      const newTeam = response.data.data;
      setTeams([newTeam, ...teams]);
      setTeamName('');
      setTeamDescription('');
      setView('list');
      if (onTeamCreated) {
        onTeamCreated(newTeam);
      }
      alert('Team created successfully!');
    } catch (error: any) {
      console.error('Failed to create team:', error);
      setError(error.response?.data?.error || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Are you sure you want to delete "${teamName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await teamApi.deleteTeam(teamId);
      setTeams(teams.filter(t => t.id !== teamId));
      if (selectedTeam?.id === teamId) {
        setSelectedTeam(null);
        setView('list');
      }
      alert('Team deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete team:', error);
      alert(error.response?.data?.error || 'Failed to delete team');
    }
  };

  const handleRemoveMember = async (memberId: string, username: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!selectedTeam || !confirm(`Remove ${username} from the team?`)) {
      return;
    }

    try {
      await teamApi.removeMember(selectedTeam.id, memberId);
      setTeamMembers(teamMembers.filter(m => m.user_id !== memberId));
      alert('Member removed successfully');
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      alert(error.response?.data?.error || 'Failed to remove member');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">
                {view === 'create' ? 'Create New Team' : view === 'detail' ? selectedTeam?.name : 'My Teams'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {view === 'list' && `${teams.length} team${teams.length !== 1 ? 's' : ''}`}
                {view === 'detail' && `${teamMembers.length} member${teamMembers.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {/* List View */}
          {view === 'list' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Create and manage your teams
                </p>
                <Button onClick={() => setView('create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Team
                </Button>
              </div>

              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Loading teams...</p>
              ) : teams.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first team to collaborate with others
                  </p>
                  <Button onClick={() => setView('create')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Team
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => fetchTeamDetails(team.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{team.name}</h3>
                          {team.description && (
                            <p className="text-sm text-muted-foreground mt-1">{team.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>{team.member_count || 0} members</span>
                            <span>{team.folder_count || 0} folders</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTeam(team.id, team.name);
                          }}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 transition-colors"
                          title="Delete team"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create View */}
          {view === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Team Name *</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter team name"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                <textarea
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  placeholder="Describe your team's purpose"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Detail View */}
          {view === 'detail' && selectedTeam && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Team Information</h3>
                <div className="bg-accent/20 rounded-lg p-4">
                  <p className="text-sm"><span className="font-medium">Name:</span> {selectedTeam.name}</p>
                  {selectedTeam.description && (
                    <p className="text-sm mt-2"><span className="font-medium">Description:</span> {selectedTeam.description}</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Team Members ({teamMembers.length})</h3>
                </div>
                <div className="space-y-2">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{member.username}</div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            member.team_role === 'lead' ? 'bg-blue-100 text-blue-700' :
                            member.team_role === 'member' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {member.team_role}
                          </span>
                        </div>
                      </div>
                      {member.user_id !== selectedTeam.owner_id && (
                        <button
                          onClick={() => handleRemoveMember(member.user_id, member.username)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-between">
          <div>
            {view !== 'list' && (
              <Button variant="outline" onClick={() => {
                setView('list');
                setError('');
                setTeamName('');
                setTeamDescription('');
              }}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {view === 'create' && (
              <>
                <Button variant="outline" onClick={() => setView('list')}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTeam} disabled={loading || !teamName.trim()}>
                  {loading ? 'Creating...' : 'Create Team'}
                </Button>
              </>
            )}
            {view === 'list' && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
            {view === 'detail' && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
