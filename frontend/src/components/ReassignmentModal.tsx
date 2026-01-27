import React, { useState, useEffect } from 'react';
import { X, UserPlus, Send } from 'lucide-react';
import { Button } from './ui/Button';
import { editorApi } from '../lib/api';

interface Editor {
  id: string;
  name: string;
  display_name?: string;
}

interface ReassignmentModalProps {
  requestId: string;
  requestTitle: string;
  onClose: () => void;
  onReassign: (editorUserId: string, note: string) => Promise<void>;
}

export function ReassignmentModal({
  requestId,
  requestTitle,
  onClose,
  onReassign
}: ReassignmentModalProps) {
  const [selectedEditorUserId, setSelectedEditorUserId] = useState('');
  const [note, setNote] = useState('');
  const [editors, setEditors] = useState<Editor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchEditors();
  }, []);

  const fetchEditors = async () => {
    try {
      const response = await editorApi.getAll();
      const editorsData = response.data.data || [];
      setEditors(editorsData);
    } catch (error: any) {
      console.error('Failed to fetch editors:', error);
      setError('Failed to load editors');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEditorUserId) {
      setError('Please select an editor');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onReassign(selectedEditorUserId, note);
      onClose();
    } catch (error: any) {
      console.error('Failed to reassign:', error);
      setError(error.response?.data?.error || 'Failed to reassign request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Reassign Request
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Request Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Request</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{requestTitle}</p>
          </div>

          {/* Editor Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reassign to Editor *
            </label>
            <select
              value={selectedEditorUserId}
              onChange={(e) => setSelectedEditorUserId(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select editor...</option>
              {editors.map((editor) => (
                <option key={editor.id} value={editor.id}>
                  {editor.display_name || editor.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reassignment Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Note for Reassigned Editor (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context about why you're reassigning this request..."
              rows={4}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This note will be visible to the reassigned editor in their notification
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedEditorUserId}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                'Reassigning...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Reassign
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
