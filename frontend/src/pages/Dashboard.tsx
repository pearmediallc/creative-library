import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { mediaApi, analyticsApi } from '../lib/api';
import { formatBytes, formatNumber } from '../lib/utils';
import { StorageStats, EditorPerformance } from '../types';
import { useAuth, isAdminRole } from '../contexts/AuthContext';
import { VerticalDashboard } from '../components/VerticalDashboard';

// Role hierarchy for dashboard access
const FULL_DASHBOARD_ROLES = ['admin', 'ceo', 'head_media_buying', 'creative_head'];
const NO_DASHBOARD_ROLES = ['buyer'];

function hasFullDashboard(role?: string): boolean {
  // Only admin and specific senior roles get full dashboard (not team_lead)
  // Team_lead gets the same view minus analytics (gated by canViewAnalytics)
  return FULL_DASHBOARD_ROLES.includes(role || '');
}

function isEditor(role?: string): boolean {
  return role === 'creative' || role === 'editor';
}

function isBuyer(role?: string): boolean {
  return role === 'buyer';
}

interface EditorDashboardData {
  editor_name: string;
  total_assigned: number;
  total_completed: number;
  total_pending: number;
  active_requests: number;
  completed_requests: number;
  requests: Array<{
    request_id: string;
    title: string;
    request_status: string;
    request_type: string;
    editor_status: string;
    assigned: number;
    completed: number;
    verticals: string;
    buyer: string;
    creator: string;
    assigned_at: string;
  }>;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [editorPerformance, setEditorPerformance] = useState<EditorPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVerticalDashboard, setShowVerticalDashboard] = useState(false);
  const [editorDashboard, setEditorDashboard] = useState<EditorDashboardData | null>(null);

  const canViewAnalytics = hasFullDashboard(user?.role);
  const isEditorUser = isEditor(user?.role);
  const isBuyerUser = isBuyer(user?.role);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Buyers get no dashboard
        if (isBuyerUser) {
          setLoading(false);
          return;
        }

        // Editors get personal dashboard only
        if (isEditorUser) {
          try {
            const editorRes = await analyticsApi.getEditorDashboard();
            setEditorDashboard(editorRes.data.data);
          } catch (err) {
            console.error('Failed to fetch editor dashboard:', err);
          }
          setLoading(false);
          return;
        }

        // Admin/CEO/HOD/ATL/VH - fetch full dashboard data
        const statsRes = await mediaApi.getStats();
        setStats(statsRes.data.data);

        // Check if user can see vertical dashboard
        if (isAdminRole(user?.role) || hasFullDashboard(user?.role)) {
          setShowVerticalDashboard(true);
        } else {
          try {
            const verticalDashRes = await analyticsApi.getVerticalDashboard();
            setShowVerticalDashboard(verticalDashRes.data.data?.length > 0);
          } catch (err) {
            setShowVerticalDashboard(false);
          }
        }

        // Only fetch analytics if user has full access
        if (canViewAnalytics) {
          const performanceRes = await analyticsApi.getEditorPerformance();
          setEditorPerformance(performanceRes.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [canViewAnalytics, user?.role]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Buyer - no dashboard access
  if (isBuyerUser) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Welcome</h1>
            <p className="text-muted-foreground">
              Use the sidebar to navigate to File Requests, Media Library, or other sections.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Editor - personal dashboard only
  if (isEditorUser && editorDashboard) {
    const progressPercent = editorDashboard.total_assigned > 0
      ? Math.round((editorDashboard.total_completed / editorDashboard.total_assigned) * 100)
      : 0;

    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">My Dashboard</h1>
            <p className="text-muted-foreground">
              Your personal creative progress - {editorDashboard.editor_name}
            </p>
          </div>

          {/* Personal Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Assigned</CardDescription>
                <CardTitle className="text-3xl">{editorDashboard.total_assigned}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Videos assigned to you</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Completed</CardDescription>
                <CardTitle className="text-3xl text-green-600">{editorDashboard.total_completed}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Videos you've uploaded</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending</CardDescription>
                <CardTitle className="text-3xl text-orange-600">{editorDashboard.total_pending}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Videos remaining</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Progress</CardDescription>
                <CardTitle className="text-3xl">{progressPercent}%</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Requests Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Active Requests ({editorDashboard.active_requests})</CardTitle>
              <CardDescription>Completed: {editorDashboard.completed_requests}</CardDescription>
            </CardHeader>
            <CardContent>
              {editorDashboard.requests.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Request</th>
                        <th className="text-left p-3 font-medium">Verticals</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-center p-3 font-medium">Assigned</th>
                        <th className="text-center p-3 font-medium">Completed</th>
                        <th className="text-center p-3 font-medium">Progress</th>
                        <th className="text-left p-3 font-medium">Buyer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {editorDashboard.requests.map((req) => {
                        const pct = req.assigned > 0 ? Math.round((req.completed / req.assigned) * 100) : 0;
                        return (
                          <tr key={req.request_id} className="hover:bg-muted/50">
                            <td className="p-3 max-w-xs truncate" title={req.title}>{req.title}</td>
                            <td className="p-3 text-xs">{req.verticals || '-'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                req.editor_status === 'completed' ? 'bg-green-100 text-green-800' :
                                req.editor_status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {req.editor_status}
                              </span>
                            </td>
                            <td className="p-3 text-center">{req.assigned}</td>
                            <td className="p-3 text-center">{req.completed}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                  <div
                                    className="h-1.5 rounded-full bg-blue-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs">{pct}%</span>
                              </div>
                            </td>
                            <td className="p-3 text-xs">{req.buyer || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active requests assigned to you</p>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Full/Partial Dashboard for admin roles
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your creative assets</p>
        </div>

        <div className={`grid gap-4 ${canViewAnalytics ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2'}`}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Files</CardDescription>
              <CardTitle className="text-3xl">{formatNumber(stats?.total_files || 0)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {formatNumber(stats?.image_count || 0)} images, {formatNumber(stats?.video_count || 0)} videos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Storage Used</CardDescription>
              <CardTitle className="text-3xl">{formatBytes(stats?.total_size_bytes || 0)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Across all media files</p>
            </CardContent>
          </Card>

          {canViewAnalytics && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Ads</CardDescription>
                  <CardTitle className="text-3xl">
                    {formatNumber(editorPerformance.reduce((sum, e) => sum + e.ad_count, 0))}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Tracked in analytics</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Spend</CardDescription>
                  <CardTitle className="text-3xl">
                    ${formatNumber(editorPerformance.reduce((sum, e) => sum + (e.total_spend || 0), 0))}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Across all campaigns</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Vertical Dashboard - show to admin/CEO/HOD/ATL/VH */}
        {showVerticalDashboard && (
          <VerticalDashboard />
        )}

        {/* Editor Performance - only for full dashboard roles */}
        {canViewAnalytics && (
          <Card>
            <CardHeader>
              <CardTitle>Editor Performance</CardTitle>
              <CardDescription>Overview of creative team performance</CardDescription>
            </CardHeader>
            <CardContent>
              {editorPerformance.length > 0 ? (
                <div className="space-y-3">
                  {editorPerformance.slice(0, 5).map((editor) => (
                    <div key={editor.editor_id} className="flex items-center justify-between py-2">
                      <div className="flex-1">
                        <p className="font-medium">{editor.editor_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(editor.ad_count)} ads • {formatNumber(editor.total_impressions)} impressions
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${formatNumber(editor.total_spend || 0)}</p>
                        <p className="text-sm text-muted-foreground">
                          CPM: ${editor.avg_cpm ? Number(editor.avg_cpm).toFixed(2) : '0.00'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No analytics data available</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
