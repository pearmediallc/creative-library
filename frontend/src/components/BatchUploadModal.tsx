import React, { useState, useCallback, useRef } from 'react';
import { X, Upload, CheckCircle, XCircle, AlertCircle, Loader, Trash2, RotateCcw, FolderOpen, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { useFileUpload, formatBytes, formatSpeed, formatTimeRemaining } from '../hooks/useFileUpload';

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editorId: string;
  currentFolderId?: string | null;
  editors: Array<{ id: string; name: string }>;
  buyers?: Array<{ id: string; name: string }>;
}

export function BatchUploadModal({
  isOpen,
  onClose,
  onSuccess,
  editorId: initialEditorId,
  currentFolderId,
  editors,
  buyers = []
}: BatchUploadModalProps) {
  const {
    uploadFiles,
    isUploading,
    stats,
    addFiles,
    removeFile,
    cancelUpload,
    retryUpload,
    uploadAll,
    clearCompleted,
    clearAll,
  } = useFileUpload();

  const [editorId, setEditorId] = useState(initialEditorId);
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [organizeByDate, setOrganizeByDate] = useState(false);
  const [assignedBuyerId, setAssignedBuyerId] = useState('');
  const [removeMetadata, setRemoveMetadata] = useState(false);
  const [addMetadata, setAddMetadata] = useState(false);
  const [folderStructure, setFolderStructure] = useState<any>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showFolderTree, setShowFolderTree] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      addFiles(files);
    }
  }, [addFiles]);

  const handleFolderSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];

      // Build folder structure from webkitRelativePath
      const structure: any = { name: 'root', children: {}, files: [] };
      const fileList: { file: File; path: string }[] = [];

      files.forEach(file => {
        // @ts-ignore - webkitRelativePath exists on File
        const relativePath = file.webkitRelativePath || file.name;
        const pathParts = relativePath.split('/');

        // Remove ONLY the filename (last part), keep the full folder path including root folder
        // Example: "test/subfolder/image.jpg" -> "test/subfolder"
        const folderPath = pathParts.slice(0, -1).join('/');

        fileList.push({ file, path: folderPath });

        // Build tree structure for preview
        let current = structure;
        pathParts.slice(0, -1).forEach((part, index) => {
          if (!current.children[part]) {
            current.children[part] = { name: part, children: {}, files: [], path: pathParts.slice(0, index + 1).join('/') };
          }
          current = current.children[part];
        });
        current.files.push(file.name);
      });

      setFolderStructure(structure);
      setShowFolderTree(true);
      setExpandedFolders(new Set(['root']));

      // Add all files with their folder paths
      fileList.forEach(({ file, path }) => {
        addFiles([file], path);
      });
    }
  }, [addFiles]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const items = Array.from(e.dataTransfer.items);
    const fileList: { file: File; path: string }[] = [];

    // Process directory entries recursively
    const processEntry = async (entry: any, path: string = ''): Promise<void> => {
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file((file: File) => {
            fileList.push({ file, path });
            resolve();
          });
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        return new Promise((resolve) => {
          dirReader.readEntries(async (entries: any[]) => {
            for (const subEntry of entries) {
              const newPath = path ? `${path}/${entry.name}` : entry.name;
              await processEntry(subEntry, newPath);
            }
            resolve();
          });
        });
      }
    };

    // Check if we have DataTransferItem API support (for folders)
    if (items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
      for (const item of items) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          await processEntry(entry);
        }
      }

      if (fileList.length > 0) {
        // Build folder structure
        const structure: any = { name: 'root', children: {}, files: [] };

        fileList.forEach(({ file, path }) => {
          const pathParts = path ? path.split('/') : [];

          let current = structure;
          pathParts.forEach((part, index) => {
            if (!current.children[part]) {
              current.children[part] = {
                name: part,
                children: {},
                files: [],
                path: pathParts.slice(0, index + 1).join('/')
              };
            }
            current = current.children[part];
          });
          current.files.push(file.name);
        });

        setFolderStructure(structure);
        setShowFolderTree(true);
        setExpandedFolders(new Set(['root']));

        // Add files with paths
        fileList.forEach(({ file, path }) => {
          addFiles([file], path);
        });
      }
    } else if (e.dataTransfer.files) {
      // Fallback for simple file drops
      const files = Array.from(e.dataTransfer.files);
      addFiles(files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleUpload = async () => {
    await uploadAll({
      editorId,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      description: description.trim() || undefined,
      folderId: currentFolderId || undefined,
      organizeByDate,
      assignedBuyerId: assignedBuyerId || undefined,
      removeMetadata,
      addMetadata,
    });

    if (stats.error === 0) {
      onSuccess();
    }
  };

  const handleClose = () => {
    if (isUploading) {
      if (!window.confirm('Upload in progress. Are you sure you want to cancel all uploads?')) {
        return;
      }
      clearAll();
    }
    onClose();
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const renderFolderTree = (node: any, depth: number = 0): React.ReactElement | null => {
    if (!node || node.name === 'root') {
      return (
        <>
          {Object.values(node.children).map((child: any) => renderFolderTree(child, depth))}
        </>
      );
    }

    const isExpanded = expandedFolders.has(node.path);
    const hasChildren = Object.keys(node.children).length > 0;
    const fileCount = node.files.length + Object.values(node.children).reduce((acc: number, child: any) => {
      return acc + child.files.length;
    }, 0);

    return (
      <div key={node.path} style={{ marginLeft: `${depth * 20}px` }}>
        <div
          className="flex items-center gap-2 py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
          onClick={() => toggleFolder(node.path)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : (
            <div style={{ width: 16 }} />
          )}
          <Folder size={16} className="text-blue-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {node.name}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({fileCount} files)
          </span>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {Object.values(node.children).map((child: any) => renderFolderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const totalProgress = stats.total > 0
    ? (stats.uploadedSize / stats.totalSize) * 100
    : 0;

  const remainingBytes = stats.totalSize - stats.uploadedSize;
  const estimatedTime = formatTimeRemaining(remainingBytes, stats.averageSpeed);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Batch Upload</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {stats.total} files • {formatBytes(stats.totalSize)} total
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
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 space-y-4">
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
                {editors.map(editor => (
                  <option key={editor.id} value={editor.id}>{editor.name}</option>
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
                  {buyers.map(buyer => (
                    <option key={buyer.id} value={buyer.id}>{buyer.name}</option>
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
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {uploadFiles.length === 0 ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center"
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Drag and drop files or folders here, or click to select
              </p>
              <div className="flex gap-3 justify-center">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  <Upload size={18} />
                  Select Files
                </label>

                <input
                  type="file"
                  ref={folderInputRef}
                  multiple
                  onChange={handleFolderSelect}
                  className="hidden"
                  id="folder-input"
                  {...({ webkitdirectory: '', directory: '' } as any)}
                />
                <label
                  htmlFor="folder-input"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer"
                >
                  <FolderOpen size={18} />
                  Select Folder
                </label>
              </div>
            </div>
          ) : (
            <>
              {/* Folder Structure Preview */}
              {showFolderTree && folderStructure && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <FolderOpen size={16} className="text-blue-500" />
                      Folder Structure Preview
                    </h3>
                    <button
                      onClick={() => setShowFolderTree(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Hide preview"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {renderFolderTree(folderStructure)}
                  </div>
                </div>
              )}

              {uploadFiles.map(file => (
                <div
                  key={file.id}
                  className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {file.status === 'success' && <CheckCircle className="text-green-500" size={18} />}
                        {file.status === 'error' && <XCircle className="text-red-500" size={18} />}
                        {file.status === 'uploading' && <Loader className="text-blue-500 animate-spin" size={18} />}
                        {file.status === 'pending' && <AlertCircle className="text-gray-400" size={18} />}

                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {file.file.name}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {file.folderPath && (
                          <div className="flex items-center gap-1 text-xs">
                            <Folder size={12} className="text-blue-500" />
                            <span className="text-blue-600 dark:text-blue-400">{file.folderPath}/</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <span>{formatBytes(file.file.size)}</span>
                          {file.status === 'uploading' && file.speed && (
                            <>
                              <span>•</span>
                              <span>{formatSpeed(file.speed)}</span>
                              <span>•</span>
                              <span>{formatTimeRemaining(
                                file.file.size * (1 - file.progress / 100),
                                file.speed
                              )}</span>
                            </>
                          )}
                          {file.status === 'error' && file.error && (
                            <>
                              <span>•</span>
                              <span className="text-red-500">{file.error}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {file.status === 'error' && (
                        <button
                          onClick={() => retryUpload(file.id, {
                            editorId,
                            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                            description: description.trim() || undefined,
                            folderId: currentFolderId || undefined,
                            organizeByDate,
                            assignedBuyerId: assignedBuyerId || undefined,
                          })}
                          className="text-blue-600 hover:text-blue-700"
                          title="Retry"
                        >
                          <RotateCcw size={18} />
                        </button>
                      )}
                      {file.status === 'uploading' && (
                        <button
                          onClick={() => cancelUpload(file.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Cancel"
                        >
                          <X size={18} />
                        </button>
                      )}
                      {(file.status === 'pending' || file.status === 'success' || file.status === 'error') && (
                        <button
                          onClick={() => removeFile(file.id)}
                          className="text-gray-400 hover:text-gray-600"
                          title="Remove"
                          disabled={isUploading}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {(file.status === 'uploading' || file.status === 'success') && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          file.status === 'success' ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Add More Files/Folders Buttons */}
              <div className="flex justify-center gap-3">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="add-more-files"
                  disabled={isUploading}
                />
                <label
                  htmlFor="add-more-files"
                  className={`inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Upload size={18} />
                  Add More Files
                </label>

                <input
                  type="file"
                  multiple
                  onChange={handleFolderSelect}
                  className="hidden"
                  id="add-more-folders"
                  disabled={isUploading}
                  {...({ webkitdirectory: '', directory: '' } as any)}
                />
                <label
                  htmlFor="add-more-folders"
                  className={`inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 dark:hover:border-green-500 cursor-pointer text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <FolderOpen size={18} />
                  Add More Folders
                </label>
              </div>
            </>
          )}
        </div>

        {/* Footer with Progress */}
        {uploadFiles.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-6 space-y-4">
            {/* Overall Progress */}
            <div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>
                  Overall Progress: {stats.success} of {stats.total} files
                </span>
                {isUploading && (
                  <span>
                    {formatBytes(stats.uploadedSize)} / {formatBytes(stats.totalSize)} • {estimatedTime} remaining
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                {stats.success > 0 && !isUploading && (
                  <button
                    onClick={clearCompleted}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    Clear Completed
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={isUploading}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Close'}
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading || stats.pending === 0 || !editorId}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : `Upload ${stats.pending} Files`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
