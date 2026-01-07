import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Home, Folder, Check, Search } from 'lucide-react';
import { folderApi } from '../lib/api';

interface BreadcrumbItem {
  id: string;
  name: string;
  level: number;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
}

interface SiblingFolder {
  id: string;
  name: string;
  file_count: number;
  color?: string;
}

export function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  // Sort items by level (descending = root to current)
  const sortedItems = [...items].sort((a, b) => b.level - a.level);

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<Record<string, SiblingFolder[]>>({});
  const [loadingSiblings, setLoadingSiblings] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
        setSearchTerm('');
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdown]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openDropdown) {
        setOpenDropdown(null);
        setSearchTerm('');
      }
    };

    if (openDropdown) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [openDropdown]);

  const loadSiblings = async (folderId: string) => {
    if (siblings[folderId]) {
      // Already loaded
      setOpenDropdown(folderId);
      return;
    }

    setLoadingSiblings({ ...loadingSiblings, [folderId]: true });
    try {
      const response = await folderApi.getSiblings(folderId);
      const siblingData = response.data.data.siblings || [];
      setSiblings({ ...siblings, [folderId]: siblingData });
      setOpenDropdown(folderId);
    } catch (error) {
      console.error('Failed to load siblings:', error);
    } finally {
      setLoadingSiblings({ ...loadingSiblings, [folderId]: false });
    }
  };

  const handleDropdownToggle = (folderId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (openDropdown === folderId) {
      setOpenDropdown(null);
      setSearchTerm('');
    } else {
      loadSiblings(folderId);
    }
  };

  const handleSiblingClick = (siblingId: string) => {
    setOpenDropdown(null);
    setSearchTerm('');
    onNavigate(siblingId);
  };

  const getFilteredSiblings = (folderId: string): SiblingFolder[] => {
    const folderSiblings = siblings[folderId] || [];
    if (!searchTerm) return folderSiblings;

    return folderSiblings.filter(sibling =>
      sibling.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 py-2 relative">
      {/* Home / All Files */}
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        title="Home"
      >
        <Home className="w-4 h-4" />
      </button>

      {sortedItems.length > 0 && (
        <ChevronRight className="w-4 h-4 text-gray-400" />
      )}

      {/* Breadcrumb items */}
      {sortedItems.map((item, index) => {
        const isLast = index === sortedItems.length - 1;
        const isOpen = openDropdown === item.id;
        const isLoading = loadingSiblings[item.id];
        const filteredSiblings = getFilteredSiblings(item.id);
        const showSearch = siblings[item.id] && siblings[item.id].length > 10;

        return (
          <React.Fragment key={item.id}>
            <div className="relative" ref={isOpen ? dropdownRef : null}>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`
                    hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[200px]
                    ${isLast ? 'font-medium text-gray-900 dark:text-gray-100' : ''}
                  `}
                  title={item.name}
                >
                  {item.name}
                </button>

                {/* Dropdown toggle - only show for non-last items */}
                {!isLast && (
                  <button
                    onClick={(e) => handleDropdownToggle(item.id, e)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    title="Show sibling folders"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {/* Dropdown Menu */}
              {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[250px] max-w-[350px]">
                  {/* Search input for many siblings */}
                  {showSearch && (
                    <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search folders..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>
                    </div>
                  )}

                  {/* Siblings list */}
                  <div className="max-h-[300px] overflow-y-auto py-1">
                    {isLoading ? (
                      <div className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                        Loading...
                      </div>
                    ) : filteredSiblings.length > 0 ? (
                      filteredSiblings.map((sibling) => {
                        const isCurrent = sibling.id === item.id;
                        return (
                          <button
                            key={sibling.id}
                            onClick={() => handleSiblingClick(sibling.id)}
                            className={`
                              w-full flex items-center gap-3 px-4 py-2 text-left transition-colors
                              ${isCurrent
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }
                            `}
                            disabled={isCurrent}
                          >
                            <Folder
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: sibling.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {sibling.name}
                                </span>
                                {isCurrent && (
                                  <Check className="w-4 h-4 flex-shrink-0" />
                                )}
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {sibling.file_count} {sibling.file_count === 1 ? 'file' : 'files'}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                        {searchTerm ? 'No matching folders' : 'No sibling folders'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {index < sortedItems.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
