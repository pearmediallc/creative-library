import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, AlertTriangle, Activity, BarChart3 } from 'lucide-react';
import { workloadApi } from '../lib/api';
import { EditorWorkloadCard } from '../components/EditorWorkloadCard';
import { EditorDetailModal } from '../components/EditorDetailModal';

interface EditorWorkload {
  id: string;
  name: string;
  displayName: string;
  activeRequests: number;
  completedRequests: number;
  totalRequests: number;
  loadPercentage: number;
  status: string;
  maxConcurrentRequests: number;
  avgCompletionTimeHours: number;
  isAvailable: boolean;
}

interface WorkloadSummary {
  totalEditors: number;
  activeEditors: number;
  totalActiveRequests: number;
  averageLoad: number;
  overloadedEditors: number;
}

export function WorkloadDashboardPage() {
  const [summary, setSummary] = useState<WorkloadSummary | null>(null);
  const [editors, setEditors] = useState<EditorWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'load' | 'active' | 'name'>('load');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEditor, setSelectedEditor] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkloadData();
  }, []);

  const fetchWorkloadData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await workloadApi.getOverview();
      setSummary(response.data.data.summary);
      setEditors(response.data.data.editors);
    } catch (err: any) {
      console.error('Failed to fetch workload data:', err);
      setError(err.response?.data?.error || 'Failed to load workload data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (load: number) => {
    if (load < 50) return 'bg-green-500';
    if (load < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      available: 'Available',
      busy: 'Busy',
      overloaded: 'Overloaded',
      at_capacity: 'At Capacity',
      unavailable: 'Unavailable'
    };
    return labels[status] || status;
  };

  const filteredAndSortedEditors = editors
    .filter(editor => {
      if (filterStatus !== 'all') {
        if (filterStatus === 'available' && editor.loadPercentage >= 50) return false;
        if (filterStatus === 'busy' && (editor.loadPercentage < 50 || editor.loadPercentage >= 80)) return false;
        if (filterStatus === 'overloaded' && editor.loadPercentage < 80) return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return editor.name.toLowerCase().includes(query) ||
               editor.displayName?.toLowerCase().includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'load') return b.loadPercentage - a.loadPercentage;
      if (sortBy === 'active') return b.activeRequests - a.activeRequests;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading workload data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <BarChart3 className="text-blue-600" size={32} />
          Editor Workload Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Monitor editor capacity and manage workload distribution
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Editors</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {summary.totalEditors}
                </p>
              </div>
              <Users className="text-blue-600" size={32} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Editors</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {summary.activeEditors}
                </p>
              </div>
              <Activity className="text-green-600" size={32} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Requests</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {summary.totalActiveRequests}
                </p>
              </div>
              <TrendingUp className="text-purple-600" size={32} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Average Load</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {Math.round(summary.averageLoad)}%
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(summary.averageLoad)}`} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Overloaded</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {summary.overloadedEditors}
                </p>
              </div>
              <AlertTriangle className="text-red-600" size={32} />
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search editors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="available">Available (&lt;50%)</option>
              <option value="busy">Busy (50-80%)</option>
              <option value="overloaded">Overloaded (&gt;80%)</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'load' | 'active' | 'name')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="load">Sort by Load</option>
              <option value="active">Sort by Active Requests</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>

          <button
            onClick={fetchWorkloadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Editor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedEditors.map(editor => (
          <EditorWorkloadCard
            key={editor.id}
            editor={editor}
            onViewDetails={() => setSelectedEditor(editor.id)}
            onRefresh={fetchWorkloadData}
          />
        ))}
      </div>

      {filteredAndSortedEditors.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No editors found matching your filters
          </p>
        </div>
      )}

      {/* Editor Detail Modal */}
      {selectedEditor && (
        <EditorDetailModal
          editorId={selectedEditor}
          onClose={() => setSelectedEditor(null)}
          onUpdate={fetchWorkloadData}
        />
      )}
    </div>
  );
}
