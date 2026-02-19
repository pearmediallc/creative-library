import React, { useEffect, useState } from 'react';
import { Card } from './ui/Card';
import { analyticsApi } from '../lib/api';
import { TrendingUp, Video, FileText, CheckCircle, Clock, ChevronDown, ChevronUp, Calendar, User, Users } from 'lucide-react';
import { getVerticalBadgeClasses } from '../constants/statusColors';

interface VerticalStats {
  vertical: string;
  file_requests: {
    total: number;
    video: number;
    pending: number;
    launched: number;
    closed: number;
    total_creatives: number;
    completed_creatives: number;
    editors_working: string;
  };
  launch_requests: {
    total: number;
    video: number;
    pending: number;
    launched: number;
    closed: number;
    total_creatives: number;
    completed_creatives: number;
    editors_working: string;
  };
  combined_total: number;
  combined_video: number;
  combined_pending: number;
  combined_creatives: number;
  combined_completed: number;
  progress_percent: number;
}

interface DetailedRequest {
  id: string;
  title: string;
  type: 'file_request' | 'launch_request';
  request_type: string;
  status: string;
  creator: string;
  buyer: string;
  editors: string;
  total_creatives: number;
  completed_creatives: number;
  progress_percent: number;
  created_at: string;
  first_assignment_at?: string;
  last_accepted_at?: string;
  launched_at?: string;
  closed_at?: string;
}

interface VerticalDetails {
  vertical: string;
  file_requests: DetailedRequest[];
  launch_requests: DetailedRequest[];
}

export function VerticalDashboard() {
  const [stats, setStats] = useState<VerticalStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedVertical, setExpandedVertical] = useState<string | null>(null);
  const [detailedData, setDetailedData] = useState<VerticalDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    fetchVerticalStats();
  }, []);

  const fetchVerticalStats = async () => {
    try {
      setLoading(true);
      const response = await analyticsApi.getVerticalDashboard();
      setStats(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch vertical stats:', err);
      setError(err.response?.data?.error || 'Failed to load vertical analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchVerticalDetails = async (vertical: string) => {
    try {
      setDetailsLoading(true);
      const response = await analyticsApi.getVerticalDetailedRequests(vertical);
      setDetailedData(response.data.data);
    } catch (err: any) {
      console.error('Failed to fetch vertical details:', err);
      alert(err.response?.data?.error || 'Failed to load detailed requests');
    } finally {
      setDetailsLoading(false);
    }
  };

  const toggleVertical = async (vertical: string) => {
    if (expandedVertical === vertical) {
      setExpandedVertical(null);
      setDetailedData(null);
    } else {
      setExpandedVertical(vertical);
      await fetchVerticalDetails(vertical);
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadgeColor = (status: string) => {
    const statusMap: Record<string, string> = {
      'open': 'bg-blue-100 text-blue-800',
      'pending': 'bg-blue-100 text-blue-800',
      'in_progress': 'bg-yellow-100 text-yellow-800',
      'uploaded': 'bg-purple-100 text-purple-800',
      'launched': 'bg-green-100 text-green-800',
      'closed': 'bg-gray-100 text-gray-800',
      'draft': 'bg-gray-100 text-gray-800',
      'pending_review': 'bg-blue-100 text-blue-800',
      'in_production': 'bg-yellow-100 text-yellow-800',
      'ready_to_launch': 'bg-purple-100 text-purple-800',
      'buyer_assigned': 'bg-indigo-100 text-indigo-800'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };

  const ProgressBar = ({ percent }: { percent: number }) => (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">Loading vertical analytics...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-red-500 dark:text-red-400">{error}</p>
        </div>
      </Card>
    );
  }

  if (stats.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">No vertical data available</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Vertical Video Request Analytics
        </h2>
        <button
          onClick={fetchVerticalStats}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.reduce((sum, v) => sum + v.combined_total, 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Video className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Video Requests</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.reduce((sum, v) => sum + v.combined_video, 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.reduce((sum, v) => sum + v.combined_pending, 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Creatives Done</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.reduce((sum, v) => sum + v.combined_completed, 0)} / {stats.reduce((sum, v) => sum + v.combined_creatives, 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Vertical Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b">
              <tr>
                <th className="text-left p-4 font-medium text-muted-foreground">Vertical</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Total Requests</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Videos</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Pending</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Launched</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Creatives Progress</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Editors Working</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stats.map((vertical) => {
                // Merge editors from both file requests and launch requests
                const allEditors = new Set([
                  ...vertical.file_requests.editors_working.split(', ').filter(Boolean),
                  ...vertical.launch_requests.editors_working.split(', ').filter(Boolean)
                ]);
                const editorsDisplay = Array.from(allEditors).join(', ') || '—';
                const isExpanded = expandedVertical === vertical.vertical;

                return (
                  <React.Fragment key={vertical.vertical}>
                    <tr
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => toggleVertical(vertical.vertical)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className={getVerticalBadgeClasses(vertical.vertical)}>
                            {vertical.vertical}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="font-medium">{vertical.combined_total}</div>
                        <div className="text-xs text-muted-foreground">
                          FR: {vertical.file_requests.total} / LR: {vertical.launch_requests.total}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Video className="w-4 h-4 text-purple-500" />
                          <span className="font-medium">{vertical.combined_video}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-4 h-4 text-orange-500" />
                          <span className="font-medium">{vertical.combined_pending}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="font-medium">
                            {vertical.file_requests.launched + vertical.launch_requests.launched}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {vertical.combined_completed} / {vertical.combined_creatives}
                            </span>
                            <span className="font-medium">{vertical.progress_percent}%</span>
                          </div>
                          <ProgressBar percent={vertical.progress_percent} />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground max-w-xs truncate" title={editorsDisplay}>
                          {editorsDisplay}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="p-0 bg-muted/30">
                          <div className="p-6">
                            {detailsLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                <span className="ml-3 text-muted-foreground">Loading details...</span>
                              </div>
                            ) : detailedData ? (
                              <div className="space-y-6">
                                {/* File Requests Section */}
                                {detailedData.file_requests.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                      <FileText className="w-4 h-4" />
                                      File Requests ({detailedData.file_requests.length})
                                    </h4>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                        <thead className="bg-muted/50 border-b">
                                          <tr>
                                            <th className="text-left p-3 font-medium">Title</th>
                                            <th className="text-left p-3 font-medium">Type</th>
                                            <th className="text-left p-3 font-medium">Status</th>
                                            <th className="text-left p-3 font-medium">Creator</th>
                                            <th className="text-left p-3 font-medium">Buyer</th>
                                            <th className="text-left p-3 font-medium">Editors</th>
                                            <th className="text-center p-3 font-medium">Progress</th>
                                            <th className="text-left p-3 font-medium">Created</th>
                                            <th className="text-left p-3 font-medium">Assigned</th>
                                            <th className="text-left p-3 font-medium">Accepted</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                          {detailedData.file_requests.map((req) => (
                                            <tr key={req.id} className="hover:bg-muted/30">
                                              <td className="p-3 max-w-xs truncate" title={req.title}>{req.title}</td>
                                              <td className="p-3">{req.request_type}</td>
                                              <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeColor(req.status)}`}>
                                                  {req.status}
                                                </span>
                                              </td>
                                              <td className="p-3">
                                                <div className="flex items-center gap-1">
                                                  <User className="w-3 h-3 text-muted-foreground" />
                                                  {req.creator || '—'}
                                                </div>
                                              </td>
                                              <td className="p-3">
                                                <div className="flex items-center gap-1">
                                                  <User className="w-3 h-3 text-muted-foreground" />
                                                  {req.buyer || '—'}
                                                </div>
                                              </td>
                                              <td className="p-3 max-w-xs truncate">
                                                <div className="flex items-center gap-1" title={req.editors}>
                                                  <Users className="w-3 h-3 text-muted-foreground" />
                                                  {req.editors}
                                                </div>
                                              </td>
                                              <td className="p-3 text-center">
                                                <div className="text-xs">
                                                  {req.completed_creatives}/{req.total_creatives} ({req.progress_percent}%)
                                                </div>
                                              </td>
                                              <td className="p-3 text-xs whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                  <Calendar className="w-3 h-3 text-muted-foreground" />
                                                  {formatDate(req.created_at)}
                                                </div>
                                              </td>
                                              <td className="p-3 text-xs whitespace-nowrap">{formatDate(req.first_assignment_at)}</td>
                                              <td className="p-3 text-xs whitespace-nowrap">{formatDate(req.last_accepted_at)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* Launch Requests Section */}
                                {detailedData.launch_requests.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                      <FileText className="w-4 h-4" />
                                      Launch Requests ({detailedData.launch_requests.length})
                                    </h4>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                        <thead className="bg-muted/50 border-b">
                                          <tr>
                                            <th className="text-left p-3 font-medium">Title</th>
                                            <th className="text-left p-3 font-medium">Type</th>
                                            <th className="text-left p-3 font-medium">Status</th>
                                            <th className="text-left p-3 font-medium">Creator</th>
                                            <th className="text-left p-3 font-medium">Buyer</th>
                                            <th className="text-left p-3 font-medium">Editors</th>
                                            <th className="text-center p-3 font-medium">Progress</th>
                                            <th className="text-left p-3 font-medium">Created</th>
                                            <th className="text-left p-3 font-medium">Assigned</th>
                                            <th className="text-left p-3 font-medium">Launched</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                          {detailedData.launch_requests.map((req) => (
                                            <tr key={req.id} className="hover:bg-muted/30">
                                              <td className="p-3 max-w-xs truncate" title={req.title}>{req.title}</td>
                                              <td className="p-3">{req.request_type}</td>
                                              <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeColor(req.status)}`}>
                                                  {req.status}
                                                </span>
                                              </td>
                                              <td className="p-3">
                                                <div className="flex items-center gap-1">
                                                  <User className="w-3 h-3 text-muted-foreground" />
                                                  {req.creator || '—'}
                                                </div>
                                              </td>
                                              <td className="p-3">
                                                <div className="flex items-center gap-1">
                                                  <User className="w-3 h-3 text-muted-foreground" />
                                                  {req.buyer || '—'}
                                                </div>
                                              </td>
                                              <td className="p-3 max-w-xs truncate">
                                                <div className="flex items-center gap-1" title={req.editors}>
                                                  <Users className="w-3 h-3 text-muted-foreground" />
                                                  {req.editors}
                                                </div>
                                              </td>
                                              <td className="p-3 text-center">
                                                <div className="text-xs">
                                                  {req.completed_creatives}/{req.total_creatives} ({req.progress_percent}%)
                                                </div>
                                              </td>
                                              <td className="p-3 text-xs whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                  <Calendar className="w-3 h-3 text-muted-foreground" />
                                                  {formatDate(req.created_at)}
                                                </div>
                                              </td>
                                              <td className="p-3 text-xs whitespace-nowrap">{formatDate(req.first_assignment_at)}</td>
                                              <td className="p-3 text-xs whitespace-nowrap">{formatDate(req.launched_at)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {detailedData.file_requests.length === 0 && detailedData.launch_requests.length === 0 && (
                                  <p className="text-center text-muted-foreground py-8">No requests found for this vertical</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-center text-muted-foreground py-8">Failed to load details</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
