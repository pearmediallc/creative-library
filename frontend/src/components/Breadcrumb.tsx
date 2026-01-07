import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  id: string;
  name: string;
  level: number;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
}

export function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  // Sort items by level (descending = root to current)
  const sortedItems = [...items].sort((a, b) => b.level - a.level);

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 py-2">
      {/* Home / All Files */}
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <Home className="w-4 h-4" />
      </button>

      {sortedItems.length > 0 && (
        <ChevronRight className="w-4 h-4 text-gray-400" />
      )}

      {/* Breadcrumb items */}
      {sortedItems.map((item, index) => (
        <React.Fragment key={item.id}>
          <button
            onClick={() => onNavigate(item.id)}
            className={`
              hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[200px]
              ${index === sortedItems.length - 1 ? 'font-medium text-gray-900 dark:text-gray-100' : ''}
            `}
            title={item.name}
          >
            {item.name}
          </button>
          {index < sortedItems.length - 1 && (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
