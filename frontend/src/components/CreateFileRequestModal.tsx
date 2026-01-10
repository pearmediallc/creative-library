import React, { useState, useEffect } from 'react';
import { X, Inbox } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { fileRequestApi, folderApi, editorApi, adminApi } from '../lib/api';
import { FILE_REQUEST_TYPES } from '../constants/fileRequestTypes';
import { PLATFORMS } from '../constants/platforms';
import { VERTICALS } from '../constants/verticals';

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
  const [requestType, setRequestType] = useState('');
  const [platform, setPlatform] = useState('');
  const [vertical, setVertical] = useState('');
  const [conceptNotes, setConceptNotes] = useState('');
  const [numCreatives, setNumCreatives] = useState<number>(1);
  const [folderId, setFolderId] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [allowMultipleUploads, setAllowMultipleUploads] = useState(true);
  const [requireEmail, setRequireEmail] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedEditorIds, setSelectedEditorIds] = useState<string[]>([]);
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

    if (!requestType) {
      setError('Request Type is required');
      return;
    }

    if (!platform) {
      setError('Platform is required');
      return;
    }

    if (!vertical) {
      setError('Vertical is required');
      return;
    }

    if (numCreatives < 1) {
      setError('Number of Creatives must be at least 1');
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
      const response = await fileRequestApi.create({
        title: requestType,
        description: conceptNotes.trim() || undefined,
        folder_id: folderId || undefined,
        deadline: deadline || undefined,
        allow_multiple_uploads: allowMultipleUploads,
        require_email: requireEmail,
        custom_message: customMessage.trim() || undefined,
        editor_id: selectedEditorIds[0] || undefined,
        assigned_buyer_id: assignedBuyerId || undefined,
        request_type: requestType,
        platform: platform,
        vertical: vertical,
        concept_notes: conceptNotes.trim() || undefined,
        num_creatives: numCreatives,
      });

      // Assign to multiple editors if selected
      if (selectedEditorIds.length > 0 && response.data?.data?.id) {
        const requestId = response.data.data.id;
        await fileRequestApi.assignEditors(requestId, selectedEditorIds);
      }

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
          {/* Request Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Request Type *
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select Request Type</option>
              {FILE_REQUEST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Platform *
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select Platform</option>
              {PLATFORMS.map((plat) => (
                <option key={plat} value={plat}>
                  {plat}
                </option>
              ))}
            </select>
          </div>

          {/* Vertical */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vertical *
            </label>
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select Vertical</option>
              {VERTICALS.map((vert) => (
                <option key={vert} value={vert}>
                  {vert}
                </option>
              ))}
            </select>
          </div>

          {/* Concept Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Concept Notes
            </label>
            <textarea
              value={conceptNotes}
              onChange={(e) => setConceptNotes(e.target.value)}
              placeholder="Describe the concept and details for this request..."
              rows={3}
              disabled={creating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Number of Creatives */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Number of Creatives *
            </label>
            <Input
              type="number"
              value={numCreatives}
              onChange={(e) => setNumCreatives(parseInt(e.target.value) || 1)}
              min={1}
              disabled={creating}
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
              Assign to Editors (optional)
            </label>
            <select
              multiple
              value={selectedEditorIds}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setSelectedEditorIds(selected);
              }}
              disabled={creating}
              size={5}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {editors.map((editor) => (
                <option key={editor.id} value={editor.id}>
                  {editor.display_name || editor.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Hold Ctrl (Windows) or Cmd (Mac) to select multiple editors
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
              disabled={creating || !requestType || !platform || !vertical}
            >
              {creating ? 'Creating...' : 'Create Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
