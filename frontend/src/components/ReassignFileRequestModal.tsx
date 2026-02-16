import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, TrendingUp } from 'lucide-react';
import { Button } from './ui/Button';
import { fileRequestApi, editorApi, workloadApi } from '../lib/api';
import { CreativeDistributionInput } from './CreativeDistributionInput';

interface ReassignFileRequestModalProps {
  requestId: string;
  requestTitle: string;
  currentEditors: Array<{ id: string; name: string }>;
  numCreatives?: number; // 🆕 Total creatives for distribution
  onClose: () => void;
  onSuccess: () => void;
}

interface Editor {
  id: string;
  name: string;
  display_name: string;
  is_active: boolean;
}

interface EditorWorkload {
  editorId: string;
  editorName: string;
  activeRequests: number;
  loadPercentage: number;
  maxConcurrentRequests: number;
  isAvailable: boolean;
}

export function ReassignFileRequestModal({
  requestId,
  requestTitle,
  currentEditors,
  numCreatives = 0,
  onClose,
  onSuccess
}: ReassignFileRequestModalProps) {
  const [allEditors, setAllEditors] = useState<Editor[]>([]);
  const [selectedEditorIds, setSelectedEditorIds] = useState<string[]>(
    currentEditors.map(e => e.id)
  );
  const [reassignReason, setReassignReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [workloadData, setWorkloadData] = useState<Map<string, EditorWorkload>>(new Map());
  const [editorDistribution, setEditorDistribution] = useState<Array<{ editor_id: string; num_creatives: number }>>([]);

  useEffect(() => {
    fetchEditors();
    fetchWorkloadData();
  }, []);

  const fetchEditors = async () => {
    try {
      const response = await editorApi.getAll();
      const editors = response.data.data || [];
      setAllEditors(editors.filter((e: Editor) => e.is_active));
    } catch (err: any) {
      console.error('Failed to fetch editors:', err);
      setError('Failed to load editors');
    }
  };

  const fetchWorkloadData = async () => {
    try {
      const response = await workloadApi.getOverview();
      const workloads = response.data.data?.editors || [];
      const workloadMap = new Map<string, EditorWorkload>();
      workloads.forEach((w: any) => {
        workloadMap.set(w.id, {
          editorId: w.id,
          editorName: w.name,
          activeRequests: w.activeRequests,
          loadPercentage: w.loadPercentage,
          maxConcurrentRequests: w.maxConcurrentRequests,
          isAvailable: w.isAvailable,
        });
      });
      setWorkloadData(workloadMap);
    } catch (err: any) {
      console.error('Failed to fetch workload data:', err);
      // Don't set error - workload is optional info
    }
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedEditorIds.length === 0) {
      setError('Please select at least one editor');
      return;
    }

    if (!reassignReason.trim()) {
      setError('Please provide a reason for reassignment');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Use reassign endpoint with creative distribution if numCreatives > 0
      if (numCreatives > 0 && editorDistribution.length > 0) {
        await fileRequestApi.reassign(requestId, {
          editor_distribution: editorDistribution,
          reason: reassignReason
        });
      } else {
        // Fall back to simple assignment
        await fileRequestApi.assignEditors(requestId, selectedEditorIds);
      }

      onSuccess();
    } catch (err: any) {
      console.error('Failed to reassign editors:', err);
      setError(err.response?.data?.error || 'Failed to reassign editors');
    } finally {
      setLoading(false);
    }
  };

  const toggleEditor = (editorId: string) => {
    setSelectedEditorIds(prev =>
      prev.includes(editorId)
        ? prev.filter(id => id !== editorId)
        : [...prev, editorId]
    );
  };

  const getLoadColor = (load: number) => {
    if (load < 50) return 'text-green-600';
    if (load < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLoadBgColor = (load: number) => {
    if (load < 50) return 'bg-green-100 dark:bg-green-900/20';
    if (load < 80) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  const getStatusBadge = (load: number, isAvailable: boolean) => {
    if (!isAvailable) return { label: 'Unavailable', color: 'bg-gray-500' };
    if (load < 50) return { label: 'Available', color: 'bg-green-500' };
    if (load < 80) return { label: 'Busy', color: 'bg-yellow-500' };
    return { label: 'Overloaded', color: 'bg-red-500' };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Reassign File Request
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{requestTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleReassign} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              </div>
            )}

            {/* Current Assignment */}
            {currentEditors.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Currently assigned to:
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  {currentEditors.map(editor => (
                    <li key={editor.id}>• {editor.name}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Editor Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Select Editors <span className="text-red-500">*</span>
              </label>
              <div className="max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                {allEditors.length > 0 ? (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {allEditors.map(editor => {
                      const workload = workloadData.get(editor.id);
                      const status = workload ? getStatusBadge(workload.loadPercentage, workload.isAvailable) : null;

                      return (
                        <label
                          key={editor.id}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedEditorIds.includes(editor.id)}
                            onChange={() => toggleEditor(editor.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {editor.display_name || editor.name}
                              </p>
                              {status && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${status.color}`}>
                                  {status.label}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {editor.name}
                            </p>
                            {workload && (
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3 text-gray-400" />
                                  <span className={`text-xs font-medium ${getLoadColor(workload.loadPercentage)}`}>
                                    {workload.loadPercentage.toFixed(0)}%
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {workload.activeRequests}/{workload.maxConcurrentRequests} requests
                                </span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Editor
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No editors available
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {selectedEditorIds.length} editor(s) selected
              </p>
            </div>

            {/* Creative Distribution (if numCreatives > 0) */}
            {numCreatives > 0 && selectedEditorIds.length > 0 && (
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Distribute Creatives Among Editors
                </h3>
                <CreativeDistributionInput
                  editors={allEditors.map(e => ({
                    ...e,
                    workload: workloadData.get(e.id) ? {
                      loadPercentage: workloadData.get(e.id)!.loadPercentage,
                      activeRequests: workloadData.get(e.id)!.activeRequests,
                      maxConcurrentRequests: workloadData.get(e.id)!.maxConcurrentRequests,
                      isAvailable: workloadData.get(e.id)!.isAvailable
                    } : undefined
                  }))}
                  totalCreatives={numCreatives}
                  selectedEditorIds={selectedEditorIds}
                  onDistributionChange={setEditorDistribution}
                />
              </div>
            )}

            {/* Reassignment Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for Reassignment <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="Explain why this request is being reassigned..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This reason will be logged for audit purposes
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || selectedEditorIds.length === 0 || !reassignReason.trim()}
              >
                {loading ? 'Reassigning...' : 'Reassign Request'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
