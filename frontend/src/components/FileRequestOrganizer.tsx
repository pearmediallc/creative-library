import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FolderPlus, ChevronDown, ChevronRight, Trash2, Edit3, Check, X, GripVertical, Play, Share2, Download, Archive, Folder, FolderOpen, LayoutGrid, List, GitBranch } from 'lucide-react';
import { Button } from './ui/Button';
import { UploadedFileCard } from './UploadedFileCard';
import { VideoPlayer } from './VideoPlayer';
import { fileRequestApi, mediaApi } from '../lib/api';
import { ShareDialog } from './ShareDialog';
import { formatBytes, formatDate } from '../lib/utils';

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
  viewMode?: 'list' | 'grid' | 'tile';
  selectedUploads: Set<string>;
  onToggleSelect: (id: string, shiftKey?: boolean) => void;
  onBatchSelect?: (ids: string[]) => void;
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
  viewMode = 'list',
  selectedUploads,
  onToggleSelect,
  onBatchSelect,
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
  const [previewUpload, setPreviewUpload] = useState<Upload | null>(null);
  const [downloadingZipFolder, setDownloadingZipFolder] = useState<string | null>(null);
  const [shareFolderData, setShareFolderData] = useState<{ fileIds: string[]; folderName: string } | null>(null);
  const [folderViewMode, setFolderViewMode] = useState<'tree' | 'cards'>('tree');
  const dragItemRef = useRef<{ uploadSessionId: string; sourceFolderId: string; index: number } | null>(null);

  // --- Lasso (rubber-band) selection ---
  const [lassoActive, setLassoActive] = useState(false);
  const [lassoStart, setLassoStart] = useState<{ x: number; y: number } | null>(null);
  const [lassoEnd, setLassoEnd] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefsMap.current.set(id, el);
    else cardRefsMap.current.delete(id);
  }, []);

  const getLassoRect = useCallback(() => {
    if (!lassoStart || !lassoEnd) return null;
    return {
      left: Math.min(lassoStart.x, lassoEnd.x),
      top: Math.min(lassoStart.y, lassoEnd.y),
      right: Math.max(lassoStart.x, lassoEnd.x),
      bottom: Math.max(lassoStart.y, lassoEnd.y),
    };
  }, [lassoStart, lassoEnd]);

  const handleLassoMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start lasso on left click, not on interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, button, a, [role="button"], .grip-handle')) return;
    // Don't start lasso if clicking directly on a card (that's click-to-select)
    if (target.closest('[data-upload-id]')) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLassoActive(true);
    const pos = { x: e.clientX, y: e.clientY };
    setLassoStart(pos);
    setLassoEnd(pos);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!lassoActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      setLassoEnd({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      // Select all cards that intersect the lasso rectangle
      const rect = getLassoRect();
      if (rect && (Math.abs(rect.right - rect.left) > 5 || Math.abs(rect.bottom - rect.top) > 5)) {
        const intersectingIds: string[] = [];
        cardRefsMap.current.forEach((el, id) => {
          const cardRect = el.getBoundingClientRect();
          const intersects =
            cardRect.left < rect.right &&
            cardRect.right > rect.left &&
            cardRect.top < rect.bottom &&
            cardRect.bottom > rect.top;
          if (intersects) {
            intersectingIds.push(id);
          }
        });
        if (intersectingIds.length > 0 && onBatchSelect) {
          onBatchSelect(intersectingIds);
        }
      }
      setLassoActive(false);
      setLassoStart(null);
      setLassoEnd(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [lassoActive, getLassoRect, onBatchSelect]);

  const lassoStyle = useMemo(() => {
    if (!lassoActive || !lassoStart || !lassoEnd) return null;
    const left = Math.min(lassoStart.x, lassoEnd.x);
    const top = Math.min(lassoStart.y, lassoEnd.y);
    const width = Math.abs(lassoEnd.x - lassoStart.x);
    const height = Math.abs(lassoEnd.y - lassoStart.y);
    if (width < 3 && height < 3) return null;
    return { position: 'fixed' as const, left, top, width, height, border: '2px dashed #3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', zIndex: 50, pointerEvents: 'none' as const };
  }, [lassoActive, lassoStart, lassoEnd]);

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
    // If this upload is part of a multi-selection, drag all selected uploads
    const isMultiDrag = selectedUploads.has(upload.id) && selectedUploads.size > 1;
    const draggedIds = isMultiDrag
      ? uploads.filter(u => selectedUploads.has(u.id)).map(u => u.upload_session_id).filter(Boolean) as string[]
      : [upload.upload_session_id || ''];

    dragItemRef.current = {
      uploadSessionId: upload.upload_session_id || '',
      sourceFolderId: folderId,
      index,
    };
    e.dataTransfer.setData('text/plain', JSON.stringify({
      uploadSessionId: upload.upload_session_id,
      uploadId: upload.id,
      sourceFolderId: folderId,
      multiIds: draggedIds,
    }));
    e.dataTransfer.effectAllowed = 'move';

    // Visual feedback: show drag count
    if (isMultiDrag) {
      const badge = document.createElement('div');
      badge.textContent = `${selectedUploads.size} files`;
      badge.style.cssText = 'position:absolute;top:-9999px;padding:4px 8px;background:#3b82f6;color:white;border-radius:4px;font-size:12px;';
      document.body.appendChild(badge);
      e.dataTransfer.setDragImage(badge, 0, 0);
      setTimeout(() => document.body.removeChild(badge), 0);
    }
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
      const sourceFolderId = data.sourceFolderId;

      // If dropping on the same folder, ignore (reorder is handled by item drop)
      if (sourceFolderId === targetFolderId) return;

      // Use multiIds if available (multi-select drag), otherwise single file
      const sessionIds: string[] = (data.multiIds && data.multiIds.length > 0
        ? data.multiIds
        : [data.uploadSessionId]).filter(Boolean);

      // Guard: don't move if no valid session IDs
      if (sessionIds.length === 0) return;

      if (targetFolderId === 'unfiled') {
        await fileRequestApi.unfileFiles(requestId, sessionIds);
      } else {
        await fileRequestApi.moveFilesToFolder(requestId, targetFolderId, sessionIds);
      }
      onRefresh();
    } catch (error) {
      console.error('Failed to move files:', error);
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

    // Save new order using media file IDs
    const orderedIds = reordered.map(u => u.id);

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

  const isVideoFile = (upload: Upload) =>
    upload.file_type?.startsWith('video/') || upload.original_filename?.match(/\.(mp4|mov|avi|webm|mkv)$/i);

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
  };

  const renderUploadCard = (upload: Upload, folderId: string, index: number) => {
    const dropIndicator = reorderingFolder === folderId && dragOverIndex === index
      ? 'border-t-2 border-blue-400 pt-1' : '';
    const isSelected = selectedUploads.has(upload.id);
    const selectedClass = isSelected ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20' : '';

    const dragProps = {
      draggable: canOrganize,
      onDragStart: (e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, upload, folderId, index),
      onDragEnd: handleDragEnd,
      onDragOver: (e: React.DragEvent<HTMLDivElement>) => { if (canOrganize) handleItemDragOver(e, folderId, index); },
      onDrop: (e: React.DragEvent<HTMLDivElement>) => { if (canOrganize) handleItemDrop(e, folderId, index); },
    };

    // Click-to-select: clicking anywhere on card selects it (except buttons/inputs/preview area)
    const handleCardClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't select if clicking on interactive elements
      if (target.closest('input, button, a, [role="button"]')) return;
      onToggleSelect(upload.id, e.shiftKey);
    };

    // Double-click to preview
    const handleDoubleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      setPreviewUpload(upload);
    };

    // Grid view: 4 per row, larger cards with thumbnail + info
    if (viewMode === 'grid') {
      return (
        <div
          key={upload.id}
          ref={(el) => registerCardRef(upload.id, el)}
          data-upload-id={upload.id}
          className={`relative group bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all cursor-pointer select-none ${dropIndicator} ${selectedClass}`}
          onClick={handleCardClick}
          onDoubleClick={handleDoubleClick}
          {...dragProps}
        >
          <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={selectedUploads.has(upload.id)} onChange={(e) => onToggleSelect(upload.id, e.nativeEvent instanceof MouseEvent ? (e.nativeEvent as MouseEvent).shiftKey : false)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
          </div>
          <div className="aspect-video bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
            {upload.thumbnail_url ? (
              <img src={upload.thumbnail_url} alt={upload.original_filename} className="w-full h-full object-cover" />
            ) : isVideoFile(upload) ? (
              <div className="text-gray-500"><svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
            ) : (
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{upload.file_type?.split('/')[1]?.toUpperCase() || 'FILE'}</span>
            )}
          </div>
          <div className="p-2">
            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{upload.original_filename}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{formatSize(upload.file_size)}</p>
          </div>
        </div>
      );
    }

    // Tile view: 6 per row, small compact tiles
    if (viewMode === 'tile') {
      return (
        <div
          key={upload.id}
          ref={(el) => registerCardRef(upload.id, el)}
          data-upload-id={upload.id}
          className={`relative group bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow transition-all cursor-pointer select-none ${dropIndicator} ${selectedClass}`}
          onClick={handleCardClick}
          onDoubleClick={handleDoubleClick}
          {...dragProps}
        >
          <div className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={selectedUploads.has(upload.id)} onChange={(e) => onToggleSelect(upload.id, e.nativeEvent instanceof MouseEvent ? (e.nativeEvent as MouseEvent).shiftKey : false)}
              className="w-3 h-3 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
          </div>
          <div className="aspect-square bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
            {upload.thumbnail_url ? (
              <img src={upload.thumbnail_url} alt={upload.original_filename} className="w-full h-full object-cover" />
            ) : isVideoFile(upload) ? (
              <div className="text-gray-500"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
            ) : (
              <span className="text-[8px] font-bold text-gray-400">{upload.file_type?.split('/')[1]?.toUpperCase() || 'FILE'}</span>
            )}
          </div>
          <p className="px-1 py-0.5 text-[9px] text-gray-700 dark:text-gray-300 truncate">{upload.original_filename}</p>
        </div>
      );
    }

    // List view (default) - entire row is clickable to select
    return (
      <div
        key={upload.id}
        ref={(el) => registerCardRef(upload.id, el)}
        data-upload-id={upload.id}
        className={`flex items-start gap-2 transition-all cursor-pointer select-none ${dropIndicator} ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 rounded' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded'}`}
        onClick={handleCardClick}
        onDoubleClick={handleDoubleClick}
        {...dragProps}
      >
        {canOrganize && (
          <GripVertical className="w-4 h-4 mt-3 text-gray-400 cursor-grab flex-shrink-0 grip-handle" />
        )}
        <input
          type="checkbox"
          checked={selectedUploads.has(upload.id)}
          onChange={(e) => onToggleSelect(upload.id, e.nativeEvent instanceof MouseEvent ? (e.nativeEvent as MouseEvent).shiftKey : false)}
          onClick={(e) => e.stopPropagation()}
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
  };

  const handleShareFolder = (folderUploads: Upload[], folderName: string) => {
    const fileIds = folderUploads.map(u => u.id);
    if (fileIds.length === 0) return;
    setShareFolderData({ fileIds, folderName });
  };

  const handleDownloadAllFolder = (folderUploads: Upload[]) => {
    folderUploads.forEach(upload => onDownload(upload));
  };

  const handleDownloadFolderZip = async (folderId: string, folderName: string, folderUploads: Upload[]) => {
    const fileIds = folderUploads.map(u => u.id);
    if (fileIds.length === 0) return;

    setDownloadingZipFolder(folderId);
    try {
      const response = await mediaApi.bulkDownloadZip(fileIds);
      const date = new Date().toISOString().split('T')[0];
      const zipFilename = `${folderName}-${date}.zip`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Failed to download folder as ZIP:', error);
      alert(error.response?.data?.error || 'Failed to download folder as ZIP');
    } finally {
      setDownloadingZipFolder(null);
    }
  };

  const renderFolderActions = (folderId: string, folderName: string, folderUploads: Upload[], isUnfiled: boolean) => (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {folderUploads.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => handleShareFolder(folderUploads, folderName)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Share folder"
          >
            <Share2 className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button
            type="button"
            onClick={() => handleDownloadAllFolder(folderUploads)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Download all files"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button
            type="button"
            onClick={() => handleDownloadFolderZip(folderId, folderName, folderUploads)}
            disabled={downloadingZipFolder === folderId}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-50"
            title="Download as ZIP"
          >
            <Archive className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </>
      )}
      {canOrganize && !isUnfiled && (
        <>
          <button
            type="button"
            onClick={() => {
              setEditingFolderId(folderId);
              setEditFolderName(folderName);
            }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Rename folder"
          >
            <Edit3 className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteFolder(folderId)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
            title="Delete folder"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </>
      )}
    </div>
  );

  const renderFolderContents = (folderId: string, folderUploads: Upload[]) => (
    <div className={`${
      viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2'
      : viewMode === 'tile' ? 'grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1'
      : 'space-y-2'
    }`}>
      {folderUploads.length > 0 ? (
        folderUploads.map((upload, index) => renderUploadCard(upload, folderId, index))
      ) : (
        <p className={`text-xs text-gray-500 dark:text-gray-400 text-center py-2 italic ${viewMode !== 'list' ? 'col-span-full' : ''}`}>
          {canOrganize ? 'Drag files here to organize' : 'No files in this folder'}
        </p>
      )}
    </div>
  );

  const renderFolderNameOrEdit = (folderId: string, folderName: string) => {
    if (editingFolderId === folderId) {
      return (
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
      );
    }
    return (
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {folderName}
      </span>
    );
  };

  // Tree view: renders folder as a tree node with tree lines and indentation
  const renderFolderTree = (folderId: string, folderName: string, folderUploads: Upload[], isUnfiled = false, isLast = false) => {
    const isExpanded = expandedFolders.has(folderId);
    const isDragOver = dragOverFolder === folderId;

    return (
      <div
        key={folderId}
        className="relative"
        onDragOver={(e) => canOrganize ? handleFolderDragOver(e, folderId) : undefined}
        onDragLeave={canOrganize ? handleFolderDragLeave : undefined}
        onDrop={(e) => canOrganize ? handleFolderDrop(e, folderId) : undefined}
      >
        {/* Tree connector line from parent */}
        <div className="flex items-stretch">
          {/* Tree line column */}
          <div className="relative flex-shrink-0" style={{ width: '24px' }}>
            {/* Vertical line */}
            <div
              className={`absolute left-3 top-0 w-px bg-gray-300 dark:bg-gray-600 ${isLast ? 'h-4' : 'h-full'}`}
            />
            {/* Horizontal branch line */}
            <div className="absolute left-3 top-4 h-px w-3 bg-gray-300 dark:bg-gray-600" />
          </div>

          {/* Folder node */}
          <div className="flex-1 min-w-0">
            <div
              className={`flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition-colors group ${
                isDragOver
                  ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800/60'
              }`}
              onClick={() => toggleFolder(folderId)}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {/* Expand/collapse chevron */}
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                )}
                {/* Folder icon */}
                {isExpanded ? (
                  <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isUnfiled ? 'text-gray-400' : 'text-amber-500'}`} />
                ) : (
                  <Folder className={`w-4 h-4 flex-shrink-0 ${isUnfiled ? 'text-gray-400' : 'text-amber-500'}`} />
                )}
                {/* Folder name */}
                {renderFolderNameOrEdit(folderId, folderName)}
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                  {folderUploads.length}
                </span>
              </div>

              {/* Actions - visible on hover */}
              {editingFolderId !== folderId && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {renderFolderActions(folderId, folderName, folderUploads, isUnfiled)}
                </div>
              )}
            </div>

            {/* Expanded contents with tree indentation */}
            {isExpanded && (
              <div className="relative ml-3 pl-4 py-1 border-l border-gray-200 dark:border-gray-700">
                {renderFolderContents(folderId, folderUploads)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Card view: renders folder as a visual card
  const renderFolderCard = (folderId: string, folderName: string, folderUploads: Upload[], isUnfiled = false) => {
    const isExpanded = expandedFolders.has(folderId);
    const isDragOver = dragOverFolder === folderId;

    // Get thumbnail previews (up to 4) for the folder card
    const previews = folderUploads.filter(u => u.thumbnail_url).slice(0, 4);

    return (
      <div
        key={folderId}
        className="flex flex-col"
        onDragOver={(e) => canOrganize ? handleFolderDragOver(e, folderId) : undefined}
        onDragLeave={canOrganize ? handleFolderDragLeave : undefined}
        onDrop={(e) => canOrganize ? handleFolderDrop(e, folderId) : undefined}
      >
        {/* Folder card */}
        <div
          className={`group relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all hover:shadow-md ${
            isDragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-md'
              : isExpanded
                ? 'border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
          }`}
          onClick={() => toggleFolder(folderId)}
        >
          {/* Thumbnail preview grid */}
          <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
            {previews.length > 0 ? (
              <div className={`w-full h-full grid ${previews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-px`}>
                {previews.map((u, i) => (
                  <img
                    key={u.id}
                    src={u.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ))}
                {previews.length < 4 && previews.length > 1 && Array.from({ length: 4 - previews.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-gray-200 dark:bg-gray-700" />
                ))}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Folder className={`w-12 h-12 ${isUnfiled ? 'text-gray-300 dark:text-gray-600' : 'text-amber-300 dark:text-amber-600'}`} />
              </div>
            )}
            {/* File count badge */}
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              {folderUploads.length} file{folderUploads.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Folder info */}
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {isExpanded ? (
                <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isUnfiled ? 'text-gray-400' : 'text-amber-500'}`} />
              ) : (
                <Folder className={`w-4 h-4 flex-shrink-0 ${isUnfiled ? 'text-gray-400' : 'text-amber-500'}`} />
              )}
              {renderFolderNameOrEdit(folderId, folderName)}
            </div>
            {editingFolderId !== folderId && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                {renderFolderActions(folderId, folderName, folderUploads, isUnfiled)}
              </div>
            )}
          </div>
        </div>

        {/* Expanded contents below the card */}
        {isExpanded && (
          <div className="mt-2 ml-2 pl-3 border-l-2 border-amber-200 dark:border-amber-800">
            {renderFolderContents(folderId, folderUploads)}
          </div>
        )}
      </div>
    );
  };

  // Legacy flat-style rendering (kept for backward compat reference, now unused)
  const renderFolderSection = (folderId: string, folderName: string, folderUploads: Upload[], isUnfiled = false, isLast = false) => {
    if (folderViewMode === 'cards') {
      return renderFolderCard(folderId, folderName, folderUploads, isUnfiled);
    }
    return renderFolderTree(folderId, folderName, folderUploads, isUnfiled, isLast);
  };

  const isImageFile = (upload: Upload) =>
    upload.file_type?.startsWith('image/') || upload.original_filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  const previewModal = previewUpload ? (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[100]"
      onClick={() => setPreviewUpload(null)}
    >
      <div className="relative w-full h-full flex items-center justify-center p-8" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setPreviewUpload(null)}
          className="absolute top-4 right-4 text-white hover:text-gray-300 z-20 bg-black/50 rounded-full p-2"
        >
          <X className="w-6 h-6" />
        </button>
        {isVideoFile(previewUpload) ? (
          <div className="w-full h-full max-w-[90vw] max-h-[80vh] flex items-center justify-center">
            <VideoPlayer
              src={previewUpload.cloudfront_url || previewUpload.s3_url}
              poster={previewUpload.thumbnail_url}
              autoPlay={true}
              className="w-full h-full"
            />
          </div>
        ) : isImageFile(previewUpload) ? (
          <img
            src={previewUpload.cloudfront_url || previewUpload.s3_url || previewUpload.thumbnail_url}
            alt={previewUpload.original_filename}
            className="max-w-full max-h-full rounded-lg object-contain shadow-2xl"
            style={{ maxHeight: '90vh', maxWidth: '90vw' }}
          />
        ) : null}
        <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-4 rounded-lg max-w-2xl mx-auto">
          <p className="font-medium truncate">{previewUpload.original_filename}</p>
          <p className="text-sm text-gray-300 mt-1">
            {formatBytes(previewUpload.file_size)} • {formatDate(previewUpload.created_at)}
          </p>
        </div>
      </div>
    </div>
  ) : null;

  // If no folders exist, render flat list (backward compat)
  if (folders.length === 0 && !canOrganize) {
    return (
      <>
        <div
          ref={containerRef}
          onMouseDown={handleLassoMouseDown}
          className={
            viewMode === 'grid' ? 'grid grid-cols-2 gap-2'
            : viewMode === 'tile' ? 'grid grid-cols-3 sm:grid-cols-4 gap-1.5'
            : 'space-y-2'
          }
        >
          {uploads.map((u, i) => renderUploadCard(u, 'unfiled', i))}
        </div>
        {lassoStyle && <div style={lassoStyle} />}
        {previewModal}
      </>
    );
  }

  return (
    <>
      <div ref={containerRef} onMouseDown={handleLassoMouseDown} className="space-y-3">
        {/* Toolbar: New Folder + Folder View Toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {canOrganize && (
              <>
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
              </>
            )}
          </div>

          {/* Folder view toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setFolderViewMode('tree')}
              className={`p-1.5 rounded transition-colors ${
                folderViewMode === 'tree'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              title="Tree view"
            >
              <GitBranch className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setFolderViewMode('cards')}
              className={`p-1.5 rounded transition-colors ${
                folderViewMode === 'cards'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Folders */}
        {folderViewMode === 'tree' ? (
          // Tree view layout
          <div className="relative">
            {folders.map((folder, index) => {
              const isLast = index === folders.length - 1 && (groupedUploads['unfiled'] || []).length === 0;
              return renderFolderSection(folder.id, folder.folder_name, groupedUploads[folder.id] || [], false, isLast);
            })}
            {renderFolderSection('unfiled', 'Unfiled', groupedUploads['unfiled'] || [], true, true)}
          </div>
        ) : (
          // Card view layout - grid of folder cards
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {folders.map(folder =>
              renderFolderSection(folder.id, folder.folder_name, groupedUploads[folder.id] || [])
            )}
            {renderFolderSection('unfiled', 'Unfiled', groupedUploads['unfiled'] || [], true)}
          </div>
        )}
      </div>
      {lassoStyle && <div style={lassoStyle} />}
      {previewModal}
      {shareFolderData && (
        <ShareDialog
          isOpen={true}
          onClose={() => setShareFolderData(null)}
          resourceId={shareFolderData.fileIds[0]}
          resourceIds={shareFolderData.fileIds.length > 1 ? shareFolderData.fileIds : undefined}
          resourceName={shareFolderData.folderName}
          resourceType="file"
        />
      )}
      {downloadingZipFolder && (
        <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Creating ZIP...
        </div>
      )}
    </>
  );
}
