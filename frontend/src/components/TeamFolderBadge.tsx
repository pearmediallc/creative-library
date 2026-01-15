import React from 'react';
import { Users } from 'lucide-react';

interface TeamFolderBadgeProps {
  teamName?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TeamFolderBadge({ teamName, className = '', size = 'md' }: TeamFolderBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium ${sizeClasses[size]} ${className}`}
      title={teamName ? `Team: ${teamName}` : 'Team Folder'}
    >
      <Users className={iconSizes[size]} />
      {teamName && <span className="truncate max-w-[120px]">{teamName}</span>}
    </span>
  );
}
