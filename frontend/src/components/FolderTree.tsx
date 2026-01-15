import React, { useEffect, useState } from 'react';
import { folderApi } from '../lib/api';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Plus, MoreVertical } from 'lucide-react';
import { Button } from './ui/Button';
import { TeamFolderBadge } from './TeamFolderBadge';

interface FolderNode {
  id: string;
  name: string;
  parent_folder_id: string | null;
  file_count?: number;
  depth: number;
  path: string[];
  s3_path: string;
  created_at: string;
  team_id?: string;
  team_name?: string;
}

interface FolderTreeProps {
  currentFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: () => void;
  onFolderContextMenu: (folder: FolderNode, event: React.MouseEvent) => void;
}

export function FolderTree({
  currentFolderId,
  onFolderSelect,
  onCreateFolder,
  onFolderContextMenu
}: FolderTreeProps) {
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const response = await folderApi.getTree();
      setFolders(response.data.data || []);
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

  const renderFolder = (folder: FolderNode) => {
    const hasChildren = getChildFolders(folder.id).length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = currentFolderId === folder.id;
    const children = getChildFolders(folder.id);

    return (
      <div key={folder.id} className="select-none">
        <div
          className={`
            flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer group
            hover:bg-gray-100 dark:hover:bg-gray-800
            ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''}
          `}
          style={{ paddingLeft: `${folder.depth * 16 + 8}px` }}
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
          <div onClick={() => onFolderSelect(folder.id)} className="flex items-center gap-2 flex-1 min-w-0">
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            )}
            <span className="text-sm truncate flex-1">{folder.name}</span>
            {folder.team_id && (
              <TeamFolderBadge teamName={folder.team_name} size="sm" />
            )}
          </div>

          {/* Context Menu Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFolderContextMenu(folder, e);
            }}
            className="opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded p-1"
          >
            <MoreVertical className="w-3 h-3 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Render children if expanded */}
        {isExpanded && children.map(child => renderFolder(child))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const rootFolders = getChildFolders(null);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Folders</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCreateFolder}
          title="New Folder"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* All Files (Root) */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2 cursor-pointer
          hover:bg-gray-100 dark:hover:bg-gray-800
          ${currentFolderId === null ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''}
        `}
        onClick={() => onFolderSelect(null)}
      >
        <Folder className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <span className="text-sm font-medium">All Files</span>
      </div>

      {/* Folder Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {rootFolders.length === 0 ? (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
            No folders yet
          </div>
        ) : (
          rootFolders.map(folder => renderFolder(folder))
        )}
      </div>
    </div>
  );
}
