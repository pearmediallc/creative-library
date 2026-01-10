import React from 'react';
import { User, FileText, CheckCircle, Clock, TrendingUp, Eye } from 'lucide-react';

interface EditorWorkloadCardProps {
  editor: {
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
  };
  onViewDetails: () => void;
  onRefresh: () => void;
}

export function EditorWorkloadCard({ editor, onViewDetails }: EditorWorkloadCardProps) {
  const getLoadColor = (load: number) => {
    if (load < 50) return 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (load < 80) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  const getStatusBadge = (load: number) => {
    if (load < 50) return { label: 'Available', color: 'bg-green-500' };
    if (load < 80) return { label: 'Busy', color: 'bg-yellow-500' };
    return { label: 'Overloaded', color: 'bg-red-500' };
  };

  const statusBadge = getStatusBadge(editor.loadPercentage);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <User className="text-blue-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {editor.displayName || editor.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{editor.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusBadge.color}`} />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {statusBadge.label}
            </span>
          </div>
        </div>
      </div>

      {/* Load Percentage */}
      <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${getLoadColor(editor.loadPercentage)}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Current Load</span>
          <span className="text-2xl font-bold">{Math.round(editor.loadPercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(editor.loadPercentage, 100)}%`,
              backgroundColor: editor.loadPercentage < 50 ? '#10b981' :
                               editor.loadPercentage < 80 ? '#f59e0b' : '#ef4444'
            }}
          />
        </div>
        <p className="text-xs mt-1 opacity-80">
          {editor.activeRequests} of {editor.maxConcurrentRequests} concurrent requests
        </p>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <FileText size={16} />
            <span>Active Requests</span>
          </div>
          <span className="font-semibold text-purple-600">{editor.activeRequests}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <CheckCircle size={16} />
            <span>Completed</span>
          </div>
          <span className="font-semibold text-green-600">{editor.completedRequests}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Clock size={16} />
            <span>Avg. Time</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">
            {editor.avgCompletionTimeHours ? `${Math.round(editor.avgCompletionTimeHours)}h` : 'N/A'}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <TrendingUp size={16} />
            <span>Total Requests</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">{editor.totalRequests}</span>
        </div>
      </div>

      {/* Action Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onViewDetails}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Eye size={16} />
          View Details
        </button>
      </div>
    </div>
  );
}
