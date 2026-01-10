import React, { useState, useEffect } from 'react';
import { X, FileText, Clock, Calendar, Folder, AlertCircle } from 'lucide-react';
import { workloadApi } from '../lib/api';
import { formatDate } from '../lib/utils';

interface EditorDetailModalProps {
  editorId: string;
  onClose: () => void;
  onUpdate: () => void;
}

interface Request {
  id: string;
  title: string;
  requestType: string;
  status: string;
  priority: number;
  complexity: string;
  estimatedHours: number;
  actualHours: number;
  deadline: string;
  createdAt: string;
  folderName: string;
}

export function EditorDetailModal({ editorId, onClose, onUpdate }: EditorDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<any>(null);
  const [requests, setRequests] = useState<Request[]>([]);

  useEffect(() => {
    fetchEditorDetails();
  }, [editorId]);

  const fetchEditorDetails = async () => {
    try {
      setLoading(true);
      const response = await workloadApi.getEditorWorkload(editorId);
      setEditor(response.data.data.editor);
      setRequests(response.data.data.requests);
    } catch (err) {
      console.error('Failed to fetch editor details:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority <= 2) return 'text-red-600 bg-red-50';
    if (priority === 3) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'bg-gray-100 text-gray-700',
      assigned: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-purple-100 text-purple-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!editor) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {editor.name} - Workload Details
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {editor.displayName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Load</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(editor.loadPercentage)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Max Capacity</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {editor.maxConcurrentRequests}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg. Time</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {editor.avgCompletionTimeHours ? `${Math.round(editor.avgCompletionTimeHours)}h` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white capitalize">
              {editor.status}
            </p>
          </div>
        </div>

        {/* Requests Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText size={20} />
            Assigned Requests ({requests.length})
          </h3>

          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No requests assigned
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Complexity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Est. Hours
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Deadline
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {requests.map(request => (
                    <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {request.title}
                          </p>
                          {request.folderName && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                              <Folder size={12} />
                              {request.folderName}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {request.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                          P{request.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {request.complexity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                          <Clock size={14} />
                          {request.estimatedHours || 'N/A'}h
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {request.deadline ? (
                          <div className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                            <Calendar size={14} />
                            {formatDate(request.deadline)}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No deadline</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
