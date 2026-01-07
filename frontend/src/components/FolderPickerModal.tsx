import React, { useEffect, useState } from 'react';
import { folderApi } from '../lib/api';
import { Folder, FolderOpen, ChevronRight, ChevronDown, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface FolderNode {
  id: string;
  name: string;
  parent_folder_id: string | null;
  file_count?: number;
  depth: number;
  path: string[];
  s3_path: string;
  created_at: string;
}

interface FolderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folderId: string | null) => void;
  title: string;
  description?: string;
  currentFolderId?: string | null;
  excludeFolderId?: string | null; // Exclude a folder from the tree (useful for move operations)
}

export function FolderPickerModal({
  isOpen,
  onClose,
  onSelect,
  title,
  description,
  currentFolderId,
  excludeFolderId
}: FolderPickerModalProps) {
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
    }
  }, [isOpen]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const response = await folderApi.getTree();
      let fetchedFolders = response.data.data || [];

      // Filter out excluded folder and its descendants
      if (excludeFolderId) {
        fetchedFolders = fetchedFolders.filter(
          (f: FolderNode) => f.id !== excludeFolderId && !f.path.includes(excludeFolderId)
        );
      }

      setFolders(fetchedFolders);
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const getChildFolders = (parentId: string | null) => {
    return folders.filter(f => f.parent_folder_id === parentId);
  };

  const handleFolderClick = (folderId: string | null) => {
    setSelectedFolderId(folderId);
  };

  const handleConfirm = () => {
    onSelect(selectedFolderId);
    onClose();
  };

  const renderFolder = (folder: FolderNode) => {
    const hasChildren = getChildFolders(folder.id).length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const children = getChildFolders(folder.id);

    return (
      <div key={folder.id} className="select-none">
        <div
          className={`
            flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer group
            hover:bg-gray-100 dark:hover:bg-gray-800
            ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : ''}
          `}
          style={{ paddingLeft: `${folder.depth * 16 + 8}px` }}
          onClick={() => handleFolderClick(folder.id)}
        >
          {/* Expand/Collapse Icon */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.id);
              }}
              className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded p-0.5"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          {/* Folder Icon */}
          <div className="flex items-center gap-2 flex-1">
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-yellow-500" />
            ) : (
              <Folder className="w-4 h-4 text-yellow-500" />
            )}
            <span className="text-sm truncate flex-1">{folder.name}</span>
            {folder.file_count !== undefined && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({folder.file_count})
              </span>
            )}
          </div>
        </div>

        {/* Render children if expanded */}
        {isExpanded && children.map(child => renderFolder(child))}
      </div>
    );
  };

  if (!isOpen) return null;

  const rootFolders = getChildFolders(null);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-white dark:bg-gray-900 max-h-[80vh] flex flex-col">
        <div className="p-6 space-y-4 flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {/* Selected Folder Display */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Destination:</strong>{' '}
              {selectedFolderId === null
                ? 'Root Folder (All Files)'
                : folders.find(f => f.id === selectedFolderId)?.name || 'Unknown'}
            </p>
          </div>

          {/* Folder Tree */}
          <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
            {loading ? (
              <div className="p-4">
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-2">
                {/* Root / All Files Option */}
                <div
                  className={`
                    flex items-center gap-2 px-3 py-2 cursor-pointer rounded mb-2
                    hover:bg-gray-100 dark:hover:bg-gray-800
                    ${selectedFolderId === null ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : ''}
                  `}
                  onClick={() => handleFolderClick(null)}
                >
                  <Folder className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm">Root Folder (All Files)</span>
                </div>

                {/* Folder Tree */}
                {rootFolders.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                    No folders available
                  </div>
                ) : (
                  rootFolders.map(folder => renderFolder(folder))
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className="flex-1"
              disabled={loading}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
