import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TeamManagementDialog } from '../components/TeamManagementDialog';
import { TeamActivityFeed } from '../components/TeamActivityFeed';
import { RequestTemplateManager } from '../components/RequestTemplateManager';
import { TeamDiscussionPanel } from '../components/TeamDiscussionPanel';
import { TeamAnalyticsDashboard } from '../components/TeamAnalyticsDashboard';
import { teamApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, FolderOpen, Activity, FileText, BarChart3, MessageSquare } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  description?: string | null;
  owner_id: string;
  member_count?: number;
  folder_count?: number;
  created_at: string;
}

type TabType = 'overview' | 'activity' | 'templates' | 'analytics' | 'discussion';

export function TeamsPageEnhanced() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await teamApi.getUserTeams();
      setTeams(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamSelect = (team: Team) => {
    setSelectedTeam(team);
    setActiveTab('overview');
  };

  const handleTeamCreated = (team: Team) => {
    fetchTeams();
    setSelectedTeam(team);
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: Users },
    { id: 'activity' as TabType, label: 'Activity', icon: Activity },
    { id: 'templates' as TabType, label: 'Templates', icon: FileText },
    { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3 },
    { id: 'discussion' as TabType, label: 'Discussion', icon: MessageSquare },
  ];

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Teams</h1>
              <p className="text-muted-foreground">
                {selectedTeam ? selectedTeam.name : 'Manage teams for collaborative work'}
              </p>
            </div>
            <div className="flex gap-2">
              {selectedTeam && (
                <Button variant="outline" onClick={() => setSelectedTeam(null)}>
                  Back to Teams
                </Button>
              )}
              <Button onClick={() => setShowManagementDialog(true)}>
                <Plus size={16} className="mr-2" />
                {selectedTeam ? 'Manage Teams' : 'Create Team'}
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {!selectedTeam ? (
            /* Teams Grid */
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Loading teams...</p>
                </div>
              ) : teams.length === 0 ? (
                <Card className="p-12 text-center">
                  <Users size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first team to collaborate with others
                  </p>
                  <Button onClick={() => setShowManagementDialog(true)}>
                    <Plus size={16} className="mr-2" />
                    Create Your First Team
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teams.map((team) => (
                    <Card
                      key={team.id}
                      className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary"
                      onClick={() => handleTeamSelect(team)}
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                          <Users size={24} className="text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{team.name}</h3>
                          {team.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {team.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users size={14} />
                          <span>{team.member_count || 0} members</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FolderOpen size={14} />
                          <span>{team.folder_count || 0} folders</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Team Detail View with Tabs */
            <div className="flex flex-col h-full">
              {/* Tabs */}
              <div className="border-b px-6">
                <div className="flex gap-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                          activeTab === tab.id
                            ? 'border-primary text-primary font-medium'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon size={18} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold mb-4">Team Information</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Name:</span>
                          <p className="text-base">{selectedTeam.name}</p>
                        </div>
                        {selectedTeam.description && (
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">
                              Description:
                            </span>
                            <p className="text-base">{selectedTeam.description}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4 pt-4">
                          <div className="p-4 bg-accent/50 rounded-lg">
                            <div className="text-2xl font-bold">{selectedTeam.member_count || 0}</div>
                            <div className="text-sm text-muted-foreground">Members</div>
                          </div>
                          <div className="p-4 bg-accent/50 rounded-lg">
                            <div className="text-2xl font-bold">{selectedTeam.folder_count || 0}</div>
                            <div className="text-sm text-muted-foreground">Folders</div>
                          </div>
                        </div>
                      </div>
                    </Card>
                    <Button onClick={() => setShowManagementDialog(true)}>
                      Manage Team Members
                    </Button>
                  </div>
                )}

                {activeTab === 'activity' && (
                  <TeamActivityFeed teamId={selectedTeam.id} />
                )}

                {activeTab === 'templates' && (
                  <RequestTemplateManager teamId={selectedTeam.id} />
                )}

                {activeTab === 'analytics' && (
                  <TeamAnalyticsDashboard teamId={selectedTeam.id} />
                )}

                {activeTab === 'discussion' && (
                  <div className="h-[600px]">
                    <TeamDiscussionPanel teamId={selectedTeam.id} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Team Management Dialog */}
        {showManagementDialog && (
          <TeamManagementDialog
            isOpen={showManagementDialog}
            onClose={() => setShowManagementDialog(false)}
            onTeamCreated={handleTeamCreated}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
