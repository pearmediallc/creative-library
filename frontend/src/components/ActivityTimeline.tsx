import React, { useEffect, useState } from 'react';
import {
  X,
  Upload,
  Download,
  Share2,
  Edit,
  Trash2,
  Edit2,
  FolderInput,
  Clock,
  Filter,
  FileDown,
  Loader2,
} from 'lucide-react';
import { activityApi } from '../lib/api';

interface ActivityLog {
  id: string;
  user_id?: string;
  user_email?: string;
  user_role?: string;
  action_type: string;
  resource_type?: string;
  resource_id?: string;
  resource_name?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  status: string;
  error_message?: string;
  created_at: string;
}

interface ActivityTimelineProps {
  fileId: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface GroupedActivities {
  [key: string]: ActivityLog[];
}

export function ActivityTimeline({ fileId, fileName, isOpen, onClose }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const actionTypes = [
    { value: 'all', label: 'All Actions' },
    { value: 'media_upload', label: 'Upload' },
    { value: 'media_download', label: 'Download' },
    { value: 'media_share', label: 'Share' },
    { value: 'media_update', label: 'Edit' },
    { value: 'media_delete', label: 'Delete' },
    { value: 'media_rename', label: 'Rename' },
    { value: 'media_move', label: 'Move' },
    { value: 'media_version_create', label: 'Version' },
  ];

  useEffect(() => {
    if (isOpen) {
      fetchActivities(true);
    }
  }, [isOpen, fileId, selectedFilter]);

  const fetchActivities = async (reset = false) => {
    try {
      setLoading(true);
      setError(null);

      const currentOffset = reset ? 0 : offset;
      const params: any = {
        limit: 20,
        offset: currentOffset,
      };

      if (selectedFilter !== 'all') {
        params.action_type = selectedFilter;
      }

      const response = await activityApi.getFileActivity(fileId, params);

      if (response.data.success) {
        const newActivities = response.data.data.logs;
        setActivities(reset ? newActivities : [...activities, ...newActivities]);
        setHasMore(response.data.data.pagination.hasMore);
        setOffset(reset ? 20 : currentOffset + 20);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    const iconMap: { [key: string]: React.ElementType } = {
      media_upload: Upload,
      media_download: Download,
      media_share: Share2,
      media_update: Edit,
      media_delete: Trash2,
      media_rename: Edit2,
      media_move: FolderInput,
      media_version_create: Clock,
    };
    return iconMap[actionType] || Edit;
  };

  const getActionLabel = (actionType: string) => {
    const labelMap: { [key: string]: string } = {
      media_upload: 'Uploaded',
      media_download: 'Downloaded',
      media_share: 'Shared',
      media_update: 'Updated',
      media_delete: 'Deleted',
      media_rename: 'Renamed',
      media_move: 'Moved',
      media_version_create: 'Created version',
    };
    return labelMap[actionType] || actionType;
  };

  const getActionColor = (actionType: string) => {
    const colorMap: { [key: string]: string } = {
      media_upload: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
      media_download: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
      media_share: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
      media_update: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300',
      media_delete: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
      media_rename: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300',
      media_move: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-300',
      media_version_create: 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300',
    };
    return colorMap[actionType] || 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300';
  };

  const groupActivitiesByDate = (activities: ActivityLog[]): GroupedActivities => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const groups: GroupedActivities = {
      Today: [],
      Yesterday: [],
      'Last Week': [],
      Older: [],
    };

    activities.forEach((activity) => {
      const activityDate = new Date(activity.created_at);
      const activityDay = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());

      if (activityDay.getTime() === today.getTime()) {
        groups.Today.push(activity);
      } else if (activityDay.getTime() === yesterday.getTime()) {
        groups.Yesterday.push(activity);
      } else if (activityDay >= lastWeek) {
        groups['Last Week'].push(activity);
      } else {
        groups.Older.push(activity);
      }
    });

    return groups;
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} months ago`;
    return `${Math.floor(seconds / 31536000)} years ago`;
  };

  const exportToCsv = () => {
    const headers = ['Date', 'Time', 'User', 'Action', 'Details', 'Status'];
    const rows = activities.map((activity) => [
      new Date(activity.created_at).toLocaleDateString(),
      new Date(activity.created_at).toLocaleTimeString(),
      activity.user_email || 'Unknown',
      getActionLabel(activity.action_type),
      activity.details ? JSON.stringify(activity.details) : '',
      activity.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${fileName}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const groupedActivities = groupActivitiesByDate(activities);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-white dark:bg-gray-900 shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Activity History</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{fileName}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Filter & Export */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <select
              value={selectedFilter}
              onChange={(e) => {
                setSelectedFilter(e.target.value);
                setOffset(0);
              }}
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {actionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={exportToCsv}
            disabled={activities.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
          >
            <FileDown className="w-4 h-4" />
            Export to CSV
          </button>
        </div>

        {/* Activity Timeline */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && activities.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-gray-400">No activity found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedActivities).map(([dateGroup, groupActivities]) => {
                if (groupActivities.length === 0) return null;

                return (
                  <div key={dateGroup}>
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                      {dateGroup}
                    </h3>
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

                      {/* Activities */}
                      <div className="space-y-4">
                        {groupActivities.map((activity) => {
                          const Icon = getActionIcon(activity.action_type);
                          return (
                            <div key={activity.id} className="relative flex gap-3">
                              {/* Icon */}
                              <div
                                className={`flex-shrink-0 w-8 h-8 rounded-full ${getActionColor(
                                  activity.action_type
                                )} flex items-center justify-center z-10`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>

                              {/* Content */}
                              <div className="flex-1 pb-4">
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                  <div className="flex items-start justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                      {getActionLabel(activity.action_type)}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {formatTimeAgo(new Date(activity.created_at))}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    by {activity.user_email || 'Unknown user'}
                                  </p>
                                  {activity.details && (
                                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                                      {typeof activity.details === 'string'
                                        ? activity.details
                                        : JSON.stringify(activity.details, null, 2)}
                                    </div>
                                  )}
                                  {activity.status === 'error' && activity.error_message && (
                                    <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                                      Error: {activity.error_message}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => fetchActivities(false)}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
