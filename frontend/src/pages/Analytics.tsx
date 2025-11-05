import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { analyticsApi } from '../lib/api';
import { EditorPerformance, AdNameChange } from '../types';
import { formatNumber } from '../lib/utils';
import { TrendingUp, AlertTriangle, RefreshCw, DollarSign, Eye, MousePointer } from 'lucide-react';

export function AnalyticsPage() {
  const [performance, setPerformance] = useState<EditorPerformance[]>([]);
  const [adsWithoutEditor, setAdsWithoutEditor] = useState<any[]>([]);
  const [adNameChanges, setAdNameChanges] = useState<AdNameChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [adAccountId, setAdAccountId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [perfRes, adsRes, changesRes] = await Promise.all([
        analyticsApi.getEditorPerformance(),
        analyticsApi.getAdsWithoutEditor(),
        analyticsApi.getAdNameChanges({ editor_changed: true }),
      ]);

      setPerformance(perfRes.data.data || []);
      setAdsWithoutEditor(adsRes.data.data || []);
      setAdNameChanges(changesRes.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!adAccountId) {
      setError('Please enter an ad account ID');
      return;
    }

    setSyncing(true);
    setError('');

    try {
      await analyticsApi.sync(adAccountId);
      await fetchAnalytics();
      setAdAccountId('');
      alert('Ads synced successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </DashboardLayout>
    );
  }

  const totalSpend = performance.reduce((sum, p) => sum + (p.total_spend || 0), 0);
  const totalImpressions = performance.reduce((sum, p) => sum + (p.total_impressions || 0), 0);
  const totalClicks = performance.reduce((sum, p) => sum + (p.total_clicks || 0), 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Facebook ad performance by editor</p>
          </div>
          <Button onClick={fetchAnalytics} variant="outline">
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>

        {/* Sync Facebook Ads */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Facebook Ads</CardTitle>
            <CardDescription>Import latest ad data from Facebook</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter ad account ID (e.g., act_123456789)"
                value={adAccountId}
                onChange={(e) => setAdAccountId(e.target.value)}
                className="max-w-md"
              />
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? 'Syncing...' : 'Sync Ads'}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}
          </CardContent>
        </Card>

        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Spend</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <DollarSign size={24} />
                ${formatNumber(Math.round(totalSpend))}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Impressions</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Eye size={24} />
                {formatNumber(totalImpressions)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Clicks</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <MousePointer size={24} />
                {formatNumber(totalClicks)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg CTR</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <TrendingUp size={24} />
                {avgCTR.toFixed(2)}%
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Editor Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Editor Performance</CardTitle>
            <CardDescription>Ad performance breakdown by creative editor</CardDescription>
          </CardHeader>
          <CardContent>
            {performance.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-4 pb-2 border-b font-medium text-sm">
                  <div>Editor</div>
                  <div className="text-right">Ads</div>
                  <div className="text-right">Spend</div>
                  <div className="text-right">Impressions</div>
                  <div className="text-right">Clicks</div>
                  <div className="text-right">CPM</div>
                  <div className="text-right">CPC</div>
                </div>
                {performance.map((editor) => (
                  <div key={editor.editor_id} className="grid grid-cols-7 gap-4 text-sm">
                    <div className="font-medium">{editor.editor_name}</div>
                    <div className="text-right text-muted-foreground">{formatNumber(editor.ad_count)}</div>
                    <div className="text-right">${formatNumber(Math.round(editor.total_spend || 0))}</div>
                    <div className="text-right">{formatNumber(editor.total_impressions || 0)}</div>
                    <div className="text-right">{formatNumber(editor.total_clicks || 0)}</div>
                    <div className="text-right">${(editor.avg_cpm || 0).toFixed(2)}</div>
                    <div className="text-right">${(editor.avg_cpc || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No performance data available. Sync Facebook ads to see analytics.</p>
            )}
          </CardContent>
        </Card>

        {/* Ads Without Editor */}
        {adsWithoutEditor.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-destructive" />
                Ads Without Editor Assignment
              </CardTitle>
              <CardDescription>
                These ads don't have a recognized editor name in the ad name
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {adsWithoutEditor.slice(0, 10).map((ad) => (
                  <div key={ad.fb_ad_id} className="flex items-center justify-between py-2 border-b">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{ad.ad_name}</p>
                      <p className="text-xs text-muted-foreground">{ad.campaign_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${Math.round(ad.spend || 0)}</p>
                      <p className="text-xs text-muted-foreground">CPM: ${(ad.cpm || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ad Name Changes */}
        {adNameChanges.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-destructive" />
                Editor Name Changes
              </CardTitle>
              <CardDescription>
                Ads where the editor name was changed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {adNameChanges.slice(0, 10).map((change) => (
                  <div key={change.id} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{change.current_ad_name || change.new_ad_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{change.campaign_name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(change.detected_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-destructive">{change.old_editor_name || 'None'}</span>
                      <span>→</span>
                      <span className="text-primary">{change.new_editor_name || 'None'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
