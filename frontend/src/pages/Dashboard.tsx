import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { mediaApi, analyticsApi, editorApi } from '../lib/api';
import { formatBytes, formatNumber } from '../lib/utils';
import { StorageStats, EditorPerformance } from '../types';

export function DashboardPage() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [editorPerformance, setEditorPerformance] = useState<EditorPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, performanceRes] = await Promise.all([
          mediaApi.getStats(),
          analyticsApi.getEditorPerformance(),
        ]);

        setStats(statsRes.data.data);
        setEditorPerformance(performanceRes.data.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your creative assets</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        </div>

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
                        CPM: ${editor.avg_cpm?.toFixed(2) || '0.00'}
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
      </div>
    </DashboardLayout>
  );
}
