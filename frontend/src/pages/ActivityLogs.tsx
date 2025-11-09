import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { activityLogApi } from '../lib/api';
import { FileText, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';

interface ActivityLog {
  id: string;
  created_at: string;
  user_email: string;
  user_role: string;
  action_type: string;
  resource_type: string;
  resource_name: string;
  status: string;
  error_message?: string;
  details?: any;
  ip_address?: string;
}

interface Filters {
  user_email?: string;
  action_type?: string;
  resource_type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit: number;
  offset: number;
}

export function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    limit: 50,
    offset: 0,
  });
  const [availableFilters, setAvailableFilters] = useState<{
    action_types: string[];
    resource_types: string[];
    statuses: string[];
  }>({
    action_types: [],
    resource_types: [],
    statuses: [],
  });

  useEffect(() => {
    fetchLogs();
    fetchFilterOptions();
  }, [filters.offset, filters.limit]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await activityLogApi.getLogs(filters);
      setLogs(response.data.data.logs || []);
      setTotal(response.data.data.pagination.total || 0);
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await activityLogApi.getFilters();
      setAvailableFilters(response.data.data || {
        action_types: [],
        resource_types: [],
        statuses: [],
      });
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  };

  const handleApplyFilters = () => {
    setFilters({ ...filters, offset: 0 }); // Reset to first page
    fetchLogs();
  };

  const handleClearFilters = () => {
    setFilters({
      limit: 50,
      offset: 0,
    });
    setTimeout(() => fetchLogs(), 100);
  };

  const nextPage = () => {
    setFilters({ ...filters, offset: filters.offset + filters.limit });
  };

  const prevPage = () => {
    setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const getStatusColor = (status: string) => {
    return status === 'success' ? 'text-primary' : 'text-destructive';
  };

  const getActionTypeLabel = (actionType: string) => {
    return actionType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;
  const totalPages = Math.ceil(total / filters.limit);

  if (loading && logs.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading activity logs...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Activity Logs</h1>
            <p className="text-muted-foreground">System-wide activity audit trail</p>
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} className="mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter activity logs by various criteria</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">User Email</label>
                    <Input
                      placeholder="user@example.com"
                      value={filters.user_email || ''}
                      onChange={(e) => setFilters({ ...filters, user_email: e.target.value || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Action Type</label>
                    <select
                      value={filters.action_type || ''}
                      onChange={(e) => setFilters({ ...filters, action_type: e.target.value || undefined })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      <option value="">All Actions</option>
                      {availableFilters.action_types.map((type) => (
                        <option key={type} value={type}>{getActionTypeLabel(type)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Resource Type</label>
                    <select
                      value={filters.resource_type || ''}
                      onChange={(e) => setFilters({ ...filters, resource_type: e.target.value || undefined })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      <option value="">All Resources</option>
                      {availableFilters.resource_types.map((type) => (
                        <option key={type} value={type}>{getActionTypeLabel(type)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <select
                      value={filters.status || ''}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      <option value="">All Statuses</option>
                      <option value="success">Success</option>
                      <option value="failure">Failure</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date From</label>
                    <Input
                      type="date"
                      value={filters.date_from || ''}
                      onChange={(e) => setFilters({ ...filters, date_from: e.target.value || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date To</label>
                    <Input
                      type="date"
                      value={filters.date_to || ''}
                      onChange={(e) => setFilters({ ...filters, date_to: e.target.value || undefined })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleApplyFilters}>Apply Filters</Button>
                  <Button variant="outline" onClick={handleClearFilters}>
                    <X size={16} className="mr-2" />
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Activity Logs Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Showing {Math.min(filters.offset + 1, total)} - {Math.min(filters.offset + filters.limit, total)} of {total} logs
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={filters.offset === 0}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={filters.offset + filters.limit >= total}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No activity logs found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-3 font-medium">Timestamp</th>
                        <th className="pb-3 font-medium">User</th>
                        <th className="pb-3 font-medium">Action</th>
                        <th className="pb-3 font-medium">Resource</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">IP Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-accent/50">
                          <td className="py-3 text-sm">{formatDate(log.created_at)}</td>
                          <td className="py-3">
                            <div>
                              <p className="text-sm font-medium">{log.user_email || 'Anonymous'}</p>
                              <p className="text-xs text-muted-foreground capitalize">{log.user_role || 'N/A'}</p>
                            </div>
                          </td>
                          <td className="py-3 text-sm">{getActionTypeLabel(log.action_type)}</td>
                          <td className="py-3">
                            <div>
                              <p className="text-sm font-medium">{log.resource_name || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {log.resource_type ? getActionTypeLabel(log.resource_type) : 'N/A'}
                              </p>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className={`text-sm font-medium capitalize ${getStatusColor(log.status)}`}>
                              {log.status}
                            </span>
                            {log.status === 'failure' && log.error_message && (
                              <p className="text-xs text-destructive mt-1">{log.error_message}</p>
                            )}
                          </td>
                          <td className="py-3 text-sm text-muted-foreground">{log.ip_address || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
