import React, { useState, useEffect } from 'react';
import { teamApi } from '../lib/api';
import { Card } from './ui/Card';
import { BarChart3, Users, MessageSquare, FileText, TrendingUp, Activity } from 'lucide-react';

interface TeamAnalyticsDashboardProps {
  teamId: string;
}

export function TeamAnalyticsDashboard({ teamId }: TeamAnalyticsDashboardProps) {
  const [summary, setSummary] = useState<any>(null);
  const [memberAnalytics, setMemberAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, [teamId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [summaryRes, membersRes] = await Promise.all([
        teamApi.getAnalyticsSummary(teamId),
        teamApi.getMemberAnalytics(teamId)
      ]);

      setSummary(summaryRes.data.data);
      setMemberAnalytics(membersRes.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p>{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Team Members</p>
              <p className="text-2xl font-bold">{summary?.members || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MessageSquare className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Messages</p>
              <p className="text-2xl font-bold">{summary?.messages || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Recent Activity</p>
              <p className="text-2xl font-bold">{summary?.recentActivity || 0}</p>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileText className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Templates</p>
              <p className="text-2xl font-bold">{summary?.templates || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-pink-100 rounded-lg">
              <BarChart3 className="h-5 w-5 text-pink-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Shared Media</p>
              <p className="text-2xl font-bold">{summary?.sharedMedia || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Folders</p>
              <p className="text-2xl font-bold">{summary?.folders || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Member Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Member Activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4">Member</th>
                <th className="text-left py-2 px-4">Role</th>
                <th className="text-right py-2 px-4">Activities</th>
                <th className="text-right py-2 px-4">Messages</th>
                <th className="text-left py-2 px-4">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {memberAnalytics.map((member: any) => (
                <tr key={member.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium">{member.name}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {member.team_role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">{member.activity_count || 0}</td>
                  <td className="py-3 px-4 text-right">{member.message_count || 0}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {member.last_active ? new Date(member.last_active).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {memberAnalytics.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No member activity data available
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
