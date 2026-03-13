import React, { useEffect, useState } from 'react';
import { folderApi } from '../lib/api';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Plus, MoreVertical, Users, Share2 } from 'lucide-react';
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
  color?: string;
  team_id?: string;
  team_name?: string;
}

interface SharedFolderNode {
  id: string;
  name: string;
  parent_folder_id: string | null;
  file_count?: number;
  depth: number;
  path: string[];
  s3_path: string;
  created_at: string;
  permission_type: string;
  shared_at: string;
  shared_by_id: string;
  shared_by_name: string;
  shared_by_email: string;
}

interface FolderTreeProps {
  currentFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: () => void;
  onFolderContextMenu: (folder: FolderNode, event: React.MouseEvent) => void;
  refreshKey?: number;
}

export function FolderTree({
  currentFolderId,
  onFolderSelect,
  onCreateFolder,
  onFolderContextMenu,
  refreshKey
}: FolderTreeProps) {
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [sharedFolders, setSharedFolders] = useState<SharedFolderNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [sharedSectionExpanded, setSharedSectionExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const fetchFolders = async () => {
    try {
      const response = await folderApi.getTree();
      setFolders(response.data.data || []);
      setSharedFolders(response.data.shared_folders || []);
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
              <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: folder.color || '#f59e0b' }} />
            ) : (
              <Folder className="w-4 h-4 flex-shrink-0" style={{ color: folder.color || '#f59e0b' }} />
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

  const renderSharedFolder = (folder: SharedFolderNode) => {
    const isSelected = currentFolderId === folder.id;

    return (
      <div key={folder.id} className="select-none">
        <div
          className={`
            flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer group
            hover:bg-gray-100 dark:hover:bg-gray-800
            ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''}
          `}
          style={{ paddingLeft: '24px' }}
          onClick={() => onFolderSelect(folder.id)}
        >
          {/* Folder Icon with share indicator */}
          <div className="relative flex-shrink-0">
            <Folder className="w-4 h-4 text-purple-500" />
            <Share2 className="w-2.5 h-2.5 text-purple-400 absolute -bottom-0.5 -right-0.5" />
          </div>

          {/* Folder Name and Sharer Info */}
          <div className="flex flex-col flex-1 min-w-0 ml-1">
            <span className="text-sm truncate">{folder.name}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
              from {folder.shared_by_name || folder.shared_by_email || 'Unknown'}
            </span>
          </div>

          {/* File count badge */}
          {folder.file_count != null && folder.file_count > 0 && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded px-1">
              {folder.file_count}
            </span>
          )}
        </div>
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
        {rootFolders.length === 0 && sharedFolders.length === 0 ? (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
            No folders yet
          </div>
        ) : (
          <>
            {rootFolders.map(folder => renderFolder(folder))}

            {/* Shared Folders Section */}
            {sharedFolders.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => setSharedSectionExpanded(!sharedSectionExpanded)}
                >
                  {sharedSectionExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                  <Users className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Shared Folders
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full px-1.5 py-0.5 ml-auto">
                    {sharedFolders.length}
                  </span>
                </div>

                {sharedSectionExpanded && (
                  <div className="mt-1">
                    {sharedFolders.map(folder => renderSharedFolder(folder))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
