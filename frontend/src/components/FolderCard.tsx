import React from 'react';
import { Folder, MoreVertical } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { TeamFolderBadge } from './TeamFolderBadge';

interface FolderCardProps {
  folder: {
    id: string;
    name: string;
    file_count?: number;
    created_at: string;
    color?: string;
    team_id?: string;
    team_name?: string;
  };
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}

export function FolderCard({ folder, onClick, onContextMenu, isSelected, onToggleSelect, cardRef }: FolderCardProps) {
  return (
    <div
      ref={cardRef}
      className={`group relative bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border-2 ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 dark:border-gray-700'}`}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e);
      }}
    >
      {/* Selection checkbox */}
      {onToggleSelect && (
        <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected || false}
            onChange={(e) => onToggleSelect(e as any)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      )}

      {/* Context menu button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu(e);
        }}
        className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      </button>

      {/* Folder icon area */}
      <div className="p-6 flex flex-col items-center justify-center">
        <Folder
          className="w-20 h-20 mb-3"
          style={{ color: folder.color || '#3b82f6' }}
          fill={folder.color || '#3b82f6'}
          fillOpacity={0.1}
        />

        {/* Folder name */}
        <h3 className="text-center font-medium text-gray-900 dark:text-white mb-1 truncate w-full px-2">
          {folder.name}
        </h3>

        {/* Team badge */}
        {folder.team_id && (
          <div className="mb-2">
            <TeamFolderBadge teamName={folder.team_name} size="sm" />
          </div>
        )}

        {/* File count */}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {folder.file_count || 0} {folder.file_count === 1 ? 'item' : 'items'}
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Created {formatDate(folder.created_at)}
        </p>
      </div>
    </div>
  );
}
