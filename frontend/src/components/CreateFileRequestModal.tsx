import React, { useState, useEffect } from 'react';
import { X, Inbox } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { fileRequestApi, folderApi, editorApi, adminApi } from '../lib/api';

interface CreateFileRequestModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Folder {
  id: string;
  name: string;
}

interface Editor {
  id: string;
  name: string;
  display_name?: string;
}

interface Buyer {
  id: string;
  name: string;
  email: string;
}

export function CreateFileRequestModal({ onClose, onSuccess }: CreateFileRequestModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [folderId, setFolderId] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [allowMultipleUploads, setAllowMultipleUploads] = useState(true);
  const [requireEmail, setRequireEmail] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [editorId, setEditorId] = useState<string>('');
  const [assignedBuyerId, setAssignedBuyerId] = useState<string>('');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFolders();
    fetchEditors();
    fetchBuyers();
  }, []);

  const fetchFolders = async () => {
    try {
      const response = await folderApi.getTree();
      setFolders(flattenFolders(response.data.data || []));
    } catch (error: any) {
      console.error('Failed to fetch folders:', error);
    }
  };

  const flattenFolders = (folders: any[], prefix = ''): Folder[] => {
    let result: Folder[] = [];
    folders.forEach((folder) => {
      const name = prefix ? `${prefix} / ${folder.name}` : folder.name;
      result.push({ id: folder.id, name });
      if (folder.children && folder.children.length > 0) {
        result = result.concat(flattenFolders(folder.children, name));
      }
    });
    return result;
  };

  const fetchEditors = async () => {
    try {
      const response = await editorApi.getAll();
      const editorsData = response.data.data || [];
      setEditors(editorsData.map((e: any) => ({
        id: e.id,
        name: e.name,
        display_name: e.display_name
      })));
    } catch (error: any) {
      console.error('Failed to fetch editors:', error);
    }
  };

  const fetchBuyers = async () => {
    try {
      const response = await adminApi.getUsers();
      const usersData = response.data.data || [];
      const buyerUsers = usersData.filter((u: any) => u.role === 'buyer');
      setBuyers(buyerUsers.map((b: any) => ({
        id: b.id,
        name: b.name,
        email: b.email
      })));
    } catch (error: any) {
      console.error('Failed to fetch buyers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (deadline) {
      const deadlineDate = new Date(deadline);
      if (deadlineDate < new Date()) {
        setError('Deadline must be a future date');
        return;
      }
    }

    setCreating(true);
    setError('');

    try {
      await fileRequestApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        folder_id: folderId || undefined,
        deadline: deadline || undefined,
        allow_multiple_uploads: allowMultipleUploads,
        require_email: requireEmail,
        custom_message: customMessage.trim() || undefined,
        editor_id: editorId || undefined,
        assigned_buyer_id: assignedBuyerId || undefined,
      });

      onSuccess();
    } catch (error: any) {
      console.error('Failed to create file request:', error);
      setError(error.response?.data?.error || 'Failed to create file request');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Create File Request
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Submit Your Product Photos"
              autoFocus
              disabled={creating}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what files you need..."
              rows={3}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Destination Folder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Destination Folder
            </label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Root / No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Uploaded files will be saved to this folder
            </p>
          </div>

          {/* Editor Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assign to Editor (optional)
            </label>
            <select
              value={editorId}
              onChange={(e) => setEditorId(e.target.value)}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">No editor assignment</option>
              {editors.map((editor) => (
                <option key={editor.id} value={editor.id}>
                  {editor.display_name || editor.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Uploaded files will be automatically assigned to this editor
            </p>
          </div>

          {/* Buyer Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assign to Buyer (optional)
            </label>
            <select
              value={assignedBuyerId}
              onChange={(e) => setAssignedBuyerId(e.target.value)}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">No buyer assignment</option>
              {buyers.map((buyer) => (
                <option key={buyer.id} value={buyer.id}>
                  {buyer.name} ({buyer.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Uploaded files will be automatically assigned to this buyer
            </p>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Deadline (optional)
            </label>
            <Input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={creating}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Request will not accept uploads after this date
            </p>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Custom Message (optional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a custom message for uploaders..."
              rows={2}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowMultipleUploads}
                onChange={(e) => setAllowMultipleUploads(e.target.checked)}
                disabled={creating}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Allow multiple file uploads
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requireEmail}
                onChange={(e) => setRequireEmail(e.target.checked)}
                disabled={creating}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Require uploader email
              </span>
            </label>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creating || !title.trim()}
            >
              {creating ? 'Creating...' : 'Create Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
