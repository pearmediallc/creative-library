import React, { useState, useEffect } from 'react';
import { teamApi } from '../lib/api';
import { Activity, Filter, RefreshCw, FolderPlus, FileUp, UserPlus, UserMinus, Settings } from 'lucide-react';
import { Button } from './ui/Button';

interface ActivityItem {
  id: string;
  activity_type: string;
  user_id: string;
  username: string;
  email: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: any;
  created_at: string;
}

interface TeamActivityFeedProps {
  teamId: string;
  limit?: number;
  showFilters?: boolean;
  className?: string;
}

const activityIcons: Record<string, React.ComponentType<any>> = {
  folder_created: FolderPlus,
  file_uploaded: FileUp,
  member_joined: UserPlus,
  member_left: UserMinus,
  member_removed: UserMinus,
  role_changed: Settings,
  template_created: FileUp,
};

const activityLabels: Record<string, string> = {
  folder_created: 'created a folder',
  file_uploaded: 'uploaded a file',
  member_joined: 'joined the team',
  member_left: 'left the team',
  member_removed: 'was removed from the team',
  role_changed: 'had their role changed',
  template_created: 'created a template',
  template_used: 'used a template',
};

export function TeamActivityFeed({
  teamId,
  limit = 20,
  showFilters = true,
  className = ''
}: TeamActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    fetchActivities();
  }, [teamId, filterType, offset]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError('');
      const params: any = { limit, offset };
      if (filterType) {
        params.type = filterType;
      }
      const response = await teamApi.getActivity(teamId, params);
      setActivities(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch activities:', error);
      setError(error.response?.data?.error || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setOffset(0);
    fetchActivities();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (type: string) => {
    const Icon = activityIcons[type] || Activity;
    return <Icon className="w-5 h-5" />;
  };

  const getActivityLabel = (activity: ActivityItem) => {
    const label = activityLabels[activity.activity_type] || activity.activity_type;
    return label;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Activity Feed</h3>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setOffset(0);
            }}
            className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Activity</option>
            <option value="folder_created">Folders</option>
            <option value="file_uploaded">Files</option>
            <option value="member_joined">Members Joined</option>
            <option value="member_removed">Members Removed</option>
            <option value="role_changed">Role Changes</option>
            <option value="template_created">Templates</option>
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Activity List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading activities...
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No activity yet</p>
          {filterType && (
            <button
              onClick={() => setFilterType('')}
              className="text-sm text-primary hover:underline mt-2"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/30 transition-colors"
            >
              <div className="p-2 rounded-full bg-primary/10 text-primary flex-shrink-0">
                {getActivityIcon(activity.activity_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{activity.username}</span>
                  {' '}
                  <span className="text-muted-foreground">{getActivityLabel(activity)}</span>
                </p>
                {activity.metadata && activity.metadata.details && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activity.metadata.details}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTimeAgo(activity.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {activities.length >= limit && (
        <div className="flex justify-center gap-2">
          {offset > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
          )}
          {activities.length === limit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
