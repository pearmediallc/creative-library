import React, { useEffect, useRef } from 'react';
import { Edit2, Trash2, FolderPlus, Info, Share2, Download, Lock, Unlock, Shield } from 'lucide-react';

interface FolderContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCreateSubfolder: () => void;
  onProperties: () => void;
  onShare?: () => void;
  onDownloadZip?: () => void;
  onToggleLock?: () => void;
  onManageAccess?: () => void;
  isLocked?: boolean;
}

export function FolderContextMenu({
  isOpen,
  position,
  onClose,
  onRename,
  onDelete,
  onCreateSubfolder,
  onProperties,
  onShare,
  onDownloadZip,
  onToggleLock,
  onManageAccess,
  isLocked
}: FolderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    {
      icon: Edit2,
      label: 'Rename',
      onClick: () => {
        onRename();
        onClose();
      }
    },
    {
      icon: FolderPlus,
      label: 'Create Subfolder',
      onClick: () => {
        onCreateSubfolder();
        onClose();
      }
    },
    ...(onDownloadZip ? [{
      icon: Download,
      label: 'Download as ZIP',
      onClick: () => {
        onDownloadZip();
        onClose();
      }
    }] : []),
    ...(onShare ? [{
      icon: Share2,
      label: 'Share',
      onClick: () => {
        onShare();
        onClose();
      }
    }] : []),
    ...(onToggleLock ? [{
      icon: isLocked ? Unlock : Lock,
      label: isLocked ? 'Unlock Folder' : 'Lock Folder',
      onClick: () => {
        onToggleLock();
        onClose();
      }
    }] : []),
    ...(onManageAccess ? [{
      icon: Shield,
      label: 'Manage Access',
      onClick: () => {
        onManageAccess();
        onClose();
      }
    }] : []),
    {
      icon: Info,
      label: 'Properties',
      onClick: () => {
        onProperties();
        onClose();
      }
    },
    {
      icon: Trash2,
      label: 'Delete',
      onClick: () => {
        onDelete();
        onClose();
      },
      danger: true
    }
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 min-w-[180px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={item.onClick}
          className={`
            w-full flex items-center gap-3 px-4 py-2 text-sm text-left
            hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
            ${item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}
          `}
        >
          <item.icon className="w-4 h-4" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
