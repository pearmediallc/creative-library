import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { fileRequestApi, adminApi } from '../lib/api';

interface ReassignFileRequestModalProps {
  requestId: string;
  requestTitle: string;
  currentEditors: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function ReassignFileRequestModal({
  requestId,
  requestTitle,
  currentEditors,
  onClose,
  onSuccess
}: ReassignFileRequestModalProps) {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedEditorIds, setSelectedEditorIds] = useState<string[]>(
    currentEditors.map(e => e.id)
  );
  const [reassignReason, setReassignReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await adminApi.getUsers();
      const users = response.data.data || [];
      setAllUsers(users);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users');
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

      await fileRequestApi.assignEditors(requestId, selectedEditorIds);

      // Optionally log the reassignment reason (if backend supports it)
      // You could add this to your API if needed
      console.log('Reassignment reason:', reassignReason);

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

  // Filter users who are editors or creatives
  const editors = allUsers.filter(u => u.role === 'creative' || u.role === 'admin');

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
                {editors.length > 0 ? (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {editors.map(user => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEditorIds.includes(user.id)}
                          onChange={() => toggleEditor(user.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {user.email}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {user.role}
                        </span>
                      </label>
                    ))}
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
