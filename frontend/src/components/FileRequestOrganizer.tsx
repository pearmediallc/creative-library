import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FolderPlus, ChevronDown, ChevronRight, Trash2, Edit3, Check, X, GripVertical } from 'lucide-react';
import { Button } from './ui/Button';
import { UploadedFileCard } from './UploadedFileCard';
import { fileRequestApi } from '../lib/api';

interface Upload {
  id: string;
  upload_session_id?: string;
  original_filename: string;
  request_folder_id?: string | null;
  request_folder_name?: string | null;
  sort_order?: number;
  [key: string]: any;
}

interface Folder {
  id: string;
  folder_name: string;
  file_count: number;
}

interface FileRequestOrganizerProps {
  requestId: string;
  uploads: Upload[];
  canOrganize: boolean;
  userRole?: string;
  selectedUploads: Set<string>;
  onToggleSelect: (id: string) => void;
  onDownload: (upload: any) => any;
  onAddToLibrary?: (upload: any) => any;
  onRemoveFromRequest?: (upload: any) => any;
  onRename: (...args: any[]) => void;
  onRefresh: () => void;
}

export function FileRequestOrganizer({
  requestId,
  uploads,
  canOrganize,
  userRole,
  selectedUploads,
  onToggleSelect,
  onDownload,
  onAddToLibrary,
  onRemoveFromRequest,
  onRename,
  onRefresh,
}: FileRequestOrganizerProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['unfiled']));
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [reorderingFolder, setReorderingFolder] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<{ uploadSessionId: string; sourceFolderId: string; index: number } | null>(null);

  const fetchFolders = useCallback(async () => {
    try {
      const response = await fileRequestApi.getFolders(requestId);
      setFolders(response.data.data || []);
      const ids = new Set(['unfiled', ...(response.data.data || []).map((f: Folder) => f.id)]);
      setExpandedFolders(ids);
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    }
  }, [requestId]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Group uploads by folder, preserving sort order
  const groupedUploads = React.useMemo(() => {
    const groups: Record<string, Upload[]> = { unfiled: [] };
    folders.forEach(f => { groups[f.id] = []; });

    uploads.forEach(upload => {
      const folderId = upload.request_folder_id || 'unfiled';
      if (!groups[folderId]) groups[folderId] = [];
      groups[folderId].push(upload);
    });

    return groups;
  }, [uploads, folders]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreating(true);
    try {
      await fileRequestApi.createFolder(requestId, { folder_name: newFolderName.trim() });
      setNewFolderName('');
      setShowNewFolder(false);
      await fetchFolders();
    } catch (error) {
      console.error('Failed to create folder:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!editFolderName.trim()) return;
    try {
      await fileRequestApi.updateFolder(requestId, folderId, { folder_name: editFolderName.trim() });
      setEditingFolderId(null);
      await fetchFolders();
    } catch (error) {
      console.error('Failed to rename folder:', error);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await fileRequestApi.deleteFolder(requestId, folderId);
      await fetchFolders();
      onRefresh();
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  };

  // --- Drag handlers for both reordering and folder moves ---
  const handleDragStart = (e: React.DragEvent, upload: Upload, folderId: string, index: number) => {
    dragItemRef.current = {
      uploadSessionId: upload.upload_session_id || '',
      sourceFolderId: folderId,
      index,
    };
    e.dataTransfer.setData('text/plain', JSON.stringify({
      uploadSessionId: upload.upload_session_id,
      uploadId: upload.id,
      sourceFolderId: folderId,
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Only highlight folder if dragging from a different folder
    if (dragItemRef.current && dragItemRef.current.sourceFolderId !== folderId) {
      setDragOverFolder(folderId);
    }
  };

  const handleFolderDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
    setDragOverIndex(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const uploadSessionId = data.uploadSessionId;
      const sourceFolderId = data.sourceFolderId;

      // If dropping on the same folder, ignore (reorder is handled by item drop)
      if (sourceFolderId === targetFolderId) return;

      if (targetFolderId === 'unfiled') {
        await fileRequestApi.unfileFiles(requestId, [uploadSessionId]);
      } else {
        await fileRequestApi.moveFilesToFolder(requestId, targetFolderId, [uploadSessionId]);
      }
      onRefresh();
    } catch (error) {
      console.error('Failed to move file:', error);
    }
  };

  // --- Reorder within a folder ---
  const handleItemDragOver = (e: React.DragEvent, folderId: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragItemRef.current && dragItemRef.current.sourceFolderId === folderId) {
      setDragOverIndex(index);
      setReorderingFolder(folderId);
    }
  };

  const handleItemDrop = async (e: React.DragEvent, folderId: string, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    setReorderingFolder(null);

    if (!dragItemRef.current || dragItemRef.current.sourceFolderId !== folderId) return;

    const folderUploads = groupedUploads[folderId] || [];
    const fromIndex = dragItemRef.current.index;
    if (fromIndex === dropIndex) return;

    // Reorder locally
    const reordered = [...folderUploads];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    // Save new order
    const orderedIds = reordered
      .map(u => u.upload_session_id)
      .filter((id): id is string => !!id);

    try {
      await fileRequestApi.reorderFiles(requestId, orderedIds);
      onRefresh();
    } catch (error) {
      console.error('Failed to reorder files:', error);
    }
  };

  const handleDragEnd = () => {
    dragItemRef.current = null;
    setDragOverIndex(null);
    setReorderingFolder(null);
    setDragOverFolder(null);
  };

  const renderUploadCard = (upload: Upload, folderId: string, index: number) => (
    <div
      key={upload.id}
      className={`flex items-start gap-2 transition-all ${
        reorderingFolder === folderId && dragOverIndex === index
          ? 'border-t-2 border-blue-400 pt-1'
          : ''
      }`}
      draggable={canOrganize}
      onDragStart={(e) => handleDragStart(e, upload, folderId, index)}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => canOrganize ? handleItemDragOver(e, folderId, index) : undefined}
      onDrop={(e) => canOrganize ? handleItemDrop(e, folderId, index) : undefined}
    >
      {canOrganize && (
        <GripVertical className="w-4 h-4 mt-3 text-gray-400 cursor-grab flex-shrink-0" />
      )}
      <input
        type="checkbox"
        checked={selectedUploads.has(upload.id)}
        onChange={() => onToggleSelect(upload.id)}
        className="mt-3 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
      />
      <div className="flex-1">
        <UploadedFileCard
          upload={upload as any}
          onDownload={onDownload}
          onAddToLibrary={onAddToLibrary}
          onRemoveFromRequest={onRemoveFromRequest}
          onRename={onRename}
        />
      </div>
    </div>
  );

  const renderFolderSection = (folderId: string, folderName: string, folderUploads: Upload[], isUnfiled = false) => {
    const isExpanded = expandedFolders.has(folderId);
    const isDragOver = dragOverFolder === folderId;

    return (
      <div
        key={folderId}
        className={`border rounded-lg overflow-hidden transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-200 dark:border-gray-700'
        }`}
        onDragOver={(e) => canOrganize ? handleFolderDragOver(e, folderId) : undefined}
        onDragLeave={canOrganize ? handleFolderDragLeave : undefined}
        onDrop={(e) => canOrganize ? handleFolderDrop(e, folderId) : undefined}
      >
        <div
          className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 cursor-pointer"
          onClick={() => toggleFolder(folderId)}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
            {editingFolderId === folderId ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameFolder(folderId);
                    if (e.key === 'Escape') setEditingFolderId(null);
                  }}
                  className="px-2 py-0.5 text-sm border rounded bg-white dark:bg-gray-700 dark:text-white"
                  autoFocus
                />
                <button type="button" onClick={() => handleRenameFolder(folderId)}>
                  <Check className="w-4 h-4 text-green-500" />
                </button>
                <button type="button" onClick={() => setEditingFolderId(null)}>
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ) : (
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {folderName}
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({folderUploads.length})
            </span>
          </div>

          {canOrganize && !isUnfiled && editingFolderId !== folderId && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => {
                  setEditingFolderId(folderId);
                  setEditFolderName(folderName);
                }}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <Edit3 className="w-3.5 h-3.5 text-gray-500" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteFolder(folderId)}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="p-3 space-y-2">
            {folderUploads.length > 0 ? (
              folderUploads.map((upload, index) => renderUploadCard(upload, folderId, index))
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2 italic">
                {canOrganize ? 'Drag files here to organize' : 'No files in this folder'}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  // If no folders exist, render flat list (backward compat)
  if (folders.length === 0 && !canOrganize) {
    return (
      <div className="space-y-2">
        {uploads.map((u, i) => renderUploadCard(u, 'unfiled', i))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canOrganize && (
        <div className="flex items-center gap-2">
          {showNewFolder ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setShowNewFolder(false);
                }}
                placeholder="Folder name (e.g., Approved, Needs Revision)"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                autoFocus
                disabled={creating}
              />
              <Button size="sm" onClick={handleCreateFolder} disabled={creating || !newFolderName.trim()}>
                Create
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-1"
            >
              <FolderPlus className="w-4 h-4" />
              New Folder
            </Button>
          )}
        </div>
      )}

      {folders.map(folder =>
        renderFolderSection(folder.id, folder.folder_name, groupedUploads[folder.id] || [])
      )}

      {renderFolderSection('unfiled', 'Unfiled', groupedUploads['unfiled'] || [], true)}
    </div>
  );
}
