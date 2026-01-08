import React, { useEffect, useRef } from 'react';
import { Download, Share2, Star, Edit2, FolderInput, Copy, Clock, Trash2, History, Info, MessageSquare, Tag } from 'lucide-react';
import { MediaFile } from '../types';

interface FileContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  file: MediaFile;
  onClose: () => void;
  onDownload: () => void;
  onShare: () => void;
  onStar: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy?: () => void;
  onVersions: () => void;
  onActivity?: () => void;
  onProperties?: () => void;
  onComments?: () => void;
  onTags?: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
}

export function FileContextMenu({
  isOpen,
  position,
  file,
  onClose,
  onDownload,
  onShare,
  onStar,
  onRename,
  onMove,
  onCopy,
  onVersions,
  onActivity,
  onProperties,
  onComments,
  onTags,
  onDelete,
  isAdmin = false
}: FileContextMenuProps) {
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
      icon: Download,
      label: 'Download',
      onClick: () => {
        onDownload();
        onClose();
      }
    },
    {
      icon: Share2,
      label: 'Share',
      onClick: () => {
        onShare();
        onClose();
      }
    },
    {
      icon: Star,
      label: file.is_starred ? 'Unstar' : 'Star',
      onClick: () => {
        onStar();
        onClose();
      }
    },
    ...(onTags ? [{
      icon: Tag,
      label: 'Manage Tags',
      onClick: () => {
        onTags();
        onClose();
      }
    }] : []),
    {
      icon: Edit2,
      label: 'Rename',
      onClick: () => {
        onRename();
        onClose();
      }
    },
    {
      icon: FolderInput,
      label: 'Move to folder',
      onClick: () => {
        onMove();
        onClose();
      }
    },
    ...(onCopy ? [{
      icon: Copy,
      label: 'Copy',
      onClick: () => {
        onCopy();
        onClose();
      }
    }] : []),
    {
      icon: Clock,
      label: 'Version History',
      onClick: () => {
        onVersions();
        onClose();
      }
    },
    ...(onActivity ? [{
      icon: History,
      label: 'Activity',
      onClick: () => {
        onActivity();
        onClose();
      }
    }] : []),
    ...(onProperties ? [{
      icon: Info,
      label: 'Properties',
      onClick: () => {
        onProperties();
        onClose();
      }
    }] : []),
    ...(onComments ? [{
      icon: MessageSquare,
      label: 'Comments',
      onClick: () => {
        onComments();
        onClose();
      }
    }] : []),
    ...(isAdmin && onDelete ? [{
      icon: Trash2,
      label: 'Delete',
      onClick: () => {
        onDelete();
        onClose();
      },
      danger: true
    }] : [])
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
