import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, TrendingUp } from 'lucide-react';
import { Button } from './ui/Button';
import { fileRequestApi, editorApi, workloadApi } from '../lib/api';
import { CreativeDistributionInput } from './CreativeDistributionInput';

interface ReassignFileRequestModalProps {
  requestId: string;
  requestTitle: string;
  currentEditors: Array<{ id: string; name: string }>;
  numCreatives?: number;
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

interface ExistingAssignment {
  editor_id: string;
  editor_name: string;
  editor_display_name: string;
  status: string;
  num_creatives_assigned: number;
  reassignment_notes: string | null;
  deliverables_quota: number | null;
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
  const [selectedEditorIds, setSelectedEditorIds] = useState<string[]>([]);
  const [reassignReason, setReassignReason] = useState('');
  const [editorQuotas, setEditorQuotas] = useState<Record<string, string>>({});
  const [editorNotes, setEditorNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [error, setError] = useState('');
  const [workloadData, setWorkloadData] = useState<Map<string, EditorWorkload>>(new Map());
  const [editorDistribution, setEditorDistribution] = useState<Array<{ editor_id: string; num_creatives: number }>>([]);
  const [existingAssignments, setExistingAssignments] = useState<ExistingAssignment[]>([]);

  useEffect(() => {
    fetchEditors();
    fetchWorkloadData();
    fetchExistingAssignments();
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
    }
  };

  const fetchExistingAssignments = async () => {
    try {
      setLoadingExisting(true);
      const response = await fileRequestApi.getAssignedEditors(requestId);
      const assignments: ExistingAssignment[] = response.data.data || [];
      setExistingAssignments(assignments);

      // Pre-select editors that are actively assigned (not reassigned/removed)
      const activeAssignments = assignments.filter(
        a => a.status && !['reassigned', 'removed'].includes(a.status)
      );
      if (activeAssignments.length > 0) {
        setSelectedEditorIds(activeAssignments.map(a => a.editor_id));

        // Pre-populate per-editor notes from existing assignments
        const notes: Record<string, string> = {};
        const quotas: Record<string, string> = {};
        const dist: Array<{ editor_id: string; num_creatives: number }> = [];

        activeAssignments.forEach(a => {
          if (a.reassignment_notes) notes[a.editor_id] = a.reassignment_notes;
          if (a.deliverables_quota) quotas[a.editor_id] = String(a.deliverables_quota);
          if (a.num_creatives_assigned > 0) {
            dist.push({ editor_id: a.editor_id, num_creatives: a.num_creatives_assigned });
          }
        });

        setEditorNotes(notes);
        setEditorQuotas(quotas);
        if (dist.length > 0) setEditorDistribution(dist);
      } else if (currentEditors.length > 0) {
        // Fallback to prop-based IDs if no active assignments found
        setSelectedEditorIds(currentEditors.map(e => e.id));
      }
    } catch (err: any) {
      console.error('Failed to fetch existing assignments:', err);
      // Fallback to prop-based selection
      setSelectedEditorIds(currentEditors.map(e => e.id));
    } finally {
      setLoadingExisting(false);
    }
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedEditorIds.length === 0) {
      setError('Please select at least one editor');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Build quotas map (optional, for main branch feature)
      const quotas: Record<string, number> = {};
      Object.entries(editorQuotas).forEach(([editorId, val]) => {
        const n = Number(val);
        if (!Number.isNaN(n) && n > 0) quotas[editorId] = Math.floor(n);
      });

      // Use reassign endpoint with creative distribution if numCreatives > 0
      if (numCreatives > 0 && editorDistribution.length > 0) {
        await fileRequestApi.reassign(requestId, {
          editor_distribution: editorDistribution,
          editor_quotas: Object.keys(quotas).length ? quotas : undefined,
          editor_notes: editorNotes,
          reason: reassignReason,
          note: reassignReason
        });
      } else {
        // Fall back to simple assignment with quotas
        await fileRequestApi.reassign(requestId, {
          editor_ids: selectedEditorIds,
          editor_quotas: Object.keys(quotas).length ? quotas : undefined,
          editor_notes: editorNotes,
          note: reassignReason
        });
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
                {existingAssignments.filter(a => !['reassigned', 'removed'].includes(a.status)).length > 0
                  ? 'Update Assignment'
                  : 'Assign File Request'}
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
            {loadingExisting ? (
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading existing assignments...</p>
              </div>
            ) : existingAssignments.filter(a => !['reassigned', 'removed'].includes(a.status)).length > 0 ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Currently assigned to:
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  {existingAssignments
                    .filter(a => !['reassigned', 'removed'].includes(a.status))
                    .map(a => (
                      <li key={a.editor_id} className="flex items-center gap-2">
                        <span>• {a.editor_display_name || a.editor_name}</span>
                        <span className="text-xs bg-blue-200 dark:bg-blue-800 px-1.5 py-0.5 rounded">
                          {a.status}
                        </span>
                        {a.num_creatives_assigned > 0 && (
                          <span className="text-xs text-blue-600 dark:text-blue-300">
                            ({a.num_creatives_assigned} creatives)
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ) : currentEditors.length > 0 ? (
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
            ) : null}

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
                        <div
                          key={editor.id}
                          className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedEditorIds.includes(editor.id)}
                            onChange={() => toggleEditor(editor.id)}
                            disabled={loading}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Editor</span>
                          </div>
                        </div>
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

              {/* Per-Editor Notes */}
              {selectedEditorIds.length > 0 && (
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Per-Editor Notes (Optional)
                  </label>
                  {selectedEditorIds.map(editorId => {
                    const editor = allEditors.find(e => e.id === editorId);
                    if (!editor) return null;
                    return (
                      <div key={editorId} className="space-y-1">
                        <label className="text-xs text-gray-600 dark:text-gray-400">
                          {editor.display_name || editor.name}
                        </label>
                        <textarea
                          value={editorNotes[editorId] || ''}
                          onChange={(e) => setEditorNotes({ ...editorNotes, [editorId]: e.target.value })}
                          disabled={loading}
                          placeholder={`Notes for ${editor.display_name || editor.name} (e.g., "Focus on quality", "Increase speed")`}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          rows={2}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
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

            {/* Reassignment Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reassignment Notes (Optional)
              </label>
              <textarea
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                disabled={loading}
                placeholder="Add notes for the reassigned editors..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                These notes will be visible to all reassigned editors
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
                disabled={loading || selectedEditorIds.length === 0}
              >
                {loading ? 'Updating...' : existingAssignments.filter(a => !['reassigned', 'removed'].includes(a.status)).length > 0 ? 'Update Assignment' : 'Assign Editors'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
