import React, { useState, useCallback } from 'react';
import { X, Upload } from 'lucide-react';
import { UploadOptions } from '../hooks/useAdvancedUpload';
import { useUploadContext } from './UploadProvider';

interface BatchUploadModalEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editorId: string;
  currentFolderId?: string | null;
  editors: Array<{ id: string; name: string }>;
  buyers?: Array<{ id: string; name: string }>;
}

export function BatchUploadModalEnhanced({
  isOpen,
  onClose,
  onSuccess,
  editorId: initialEditorId,
  currentFolderId,
  editors,
  buyers = [],
}: BatchUploadModalEnhancedProps) {
  const { addFiles, startUpload, tasks, isUploading } = useUploadContext();

  const [editorId, setEditorId] = useState(initialEditorId);
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [organizeByDate, setOrganizeByDate] = useState(false);
  const [assignedBuyerId, setAssignedBuyerId] = useState('');
  const [removeMetadata, setRemoveMetadata] = useState(false);
  const [addMetadata, setAddMetadata] = useState(false);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const files = Array.from(e.target.files);
        await addFiles(files);
      }
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.dataTransfer.files) {
        const files = Array.from(e.dataTransfer.files);
        await addFiles(files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleUpload = async () => {
    const options: UploadOptions = {
      editorId,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      description: description.trim() || undefined,
      folderId: currentFolderId || undefined,
      organizeByDate,
      assignedBuyerId: assignedBuyerId || undefined,
      removeMetadata,
      addMetadata,
    };

    await startUpload(options);
    onSuccess();
    onClose();
  };

  const handleClose = () => {
    if (isUploading) {
      if (!window.confirm('Upload in progress. Are you sure you want to close? The uploads will continue in the background.')) {
        return;
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Files</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure upload settings and add files
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Upload Options */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Editor *
              </label>
              <select
                value={editorId}
                onChange={(e) => setEditorId(e.target.value)}
                disabled={isUploading}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                required
              >
                <option value="">Select editor...</option>
                {editors.map((editor) => (
                  <option key={editor.id} value={editor.id}>
                    {editor.name}
                  </option>
                ))}
              </select>
            </div>

            {buyers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assign to Buyer
                </label>
                <select
                  value={assignedBuyerId}
                  onChange={(e) => setAssignedBuyerId(e.target.value)}
                  disabled={isUploading}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                >
                  <option value="">None</option>
                  {buyers.map((buyer) => (
                    <option key={buyer.id} value={buyer.id}>
                      {buyer.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={isUploading}
              placeholder="e.g., campaign, product, banner"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
              placeholder="Optional description for all files..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
              rows={2}
            />
          </div>

          <div className="flex flex-wrap gap-4">
            {!currentFolderId && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={organizeByDate}
                  onChange={(e) => setOrganizeByDate(e.target.checked)}
                  disabled={isUploading}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Organize by date (jan2024/15-jan/)
                </span>
              </label>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={removeMetadata}
                onChange={(e) => setRemoveMetadata(e.target.checked)}
                disabled={isUploading}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Remove metadata</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={addMetadata}
                onChange={(e) => setAddMetadata(e.target.checked)}
                disabled={isUploading}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Add watermark</span>
            </label>
          </div>

          {/* File Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Drag and drop files here, or click to select
            </p>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-input-enhanced"
              disabled={isUploading}
            />
            <label
              htmlFor="file-input-enhanced"
              className={`inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer ${
                isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Select Files
            </label>
            {tasks.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                {tasks.length} file{tasks.length !== 1 ? 's' : ''} ready to upload
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {isUploading ? 'Close (uploads continue)' : 'Cancel'}
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading || tasks.length === 0 || !editorId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Starting...' : `Upload ${tasks.length} File${tasks.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
