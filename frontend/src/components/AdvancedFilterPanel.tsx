import React, { useState } from 'react';
import { X, Calendar, Image as ImageIcon, Video, User, Folder, Tag, SlidersHorizontal, Save } from 'lucide-react';
import { MediaFilters } from '../hooks/useMediaFilters';
import { CreateCollectionModal } from './CreateCollectionModal';

interface AdvancedFilterPanelProps {
  filters: MediaFilters;
  onFilterChange: <K extends keyof MediaFilters>(key: K, value: MediaFilters[K]) => void;
  onToggleMediaType: (type: 'image' | 'video') => void;
  onToggleEditor: (editorId: string) => void;
  onToggleBuyer: (buyerId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onToggleTag: (tag: string) => void;
  onClear: () => void;
  onClose: () => void;
  editors: Array<{ id: string; name: string }>;
  buyers: Array<{ id: string; name: string }>;
  folders: Array<{ id: string; name: string }>;
  availableTags: string[];
}

export function AdvancedFilterPanel({
  filters,
  onFilterChange,
  onToggleMediaType,
  onToggleEditor,
  onToggleBuyer,
  onToggleFolder,
  onToggleTag,
  onClear,
  onClose,
  editors = [],
  buyers = [],
  folders = [],
  availableTags = [],
}: AdvancedFilterPanelProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);

  const hasActiveFilters = () => {
    return (
      filters.search !== '' ||
      filters.dateFrom !== null ||
      filters.dateTo !== null ||
      filters.mediaTypes.length > 0 ||
      filters.editorIds.length > 0 ||
      filters.buyerIds.length > 0 ||
      filters.folderIds.length > 0 ||
      filters.tags.length > 0 ||
      filters.sizeMin !== undefined ||
      filters.sizeMax !== undefined ||
      filters.widthMin !== undefined ||
      filters.widthMax !== undefined ||
      filters.heightMin !== undefined ||
      filters.heightMax !== undefined
    );
  };

  return (
    <>
    {/* Backdrop overlay */}
    <div className="fixed inset-0 z-40" onClick={onClose}></div>

    {/* Dropdown panel - positioned absolutely near the filter button */}
    <div className="absolute top-full left-0 mt-2 w-96 max-h-[80vh] bg-white dark:bg-gray-800 shadow-2xl rounded-lg overflow-hidden z-50 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={20} className="text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Advanced Filters</h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Scrollable content container */}
      <div className="overflow-y-auto max-h-[calc(80vh-140px)]">

        {/* Filter Content */}
        <div className="p-4 space-y-6">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFilterChange('search', e.target.value)}
              placeholder="Search files..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Calendar size={16} />
              Date Range
            </label>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">From</label>
                <input
                  type="date"
                  value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
                  onChange={(e) => onFilterChange('dateFrom', e.target.value ? new Date(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">To</label>
                <input
                  type="date"
                  value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
                  onChange={(e) => onFilterChange('dateTo', e.target.value ? new Date(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Media Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Media Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.mediaTypes.includes('image')}
                  onChange={() => onToggleMediaType('image')}
                  className="rounded"
                />
                <ImageIcon size={16} className="text-blue-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Images</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.mediaTypes.includes('video')}
                  onChange={() => onToggleMediaType('video')}
                  className="rounded"
                />
                <Video size={16} className="text-purple-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Videos</span>
              </label>
            </div>
          </div>

          {/* Editors */}
          {editors.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <User size={16} />
                Editors
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {editors.map(editor => (
                  <label key={editor.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.editorIds.includes(editor.id)}
                      onChange={() => onToggleEditor(editor.id)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{editor.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Buyers */}
          {buyers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <User size={16} />
                Assigned Buyers
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {buyers.map(buyer => (
                  <label key={buyer.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.buyerIds.includes(buyer.id)}
                      onChange={() => onToggleBuyer(buyer.id)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{buyer.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Folders */}
          {folders.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Folder size={16} />
                Folders
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {folders.map(folder => (
                  <label key={folder.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.folderIds.includes(folder.id)}
                      onChange={() => onToggleFolder(folder.id)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{folder.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {availableTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Tag size={16} />
                Tags
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {availableTags.map(tag => (
                  <label key={tag} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.tags.includes(tag)}
                      onChange={() => onToggleTag(tag)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* File Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              File Size (MB)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Min</label>
                <input
                  type="number"
                  value={filters.sizeMin || ''}
                  onChange={(e) => onFilterChange('sizeMin', e.target.value ? Number(e.target.value) * 1024 * 1024 : undefined)}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Max</label>
                <input
                  type="number"
                  value={filters.sizeMax || ''}
                  onChange={(e) => onFilterChange('sizeMax', e.target.value ? Number(e.target.value) * 1024 * 1024 : undefined)}
                  placeholder="∞"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Image Resolution */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Resolution (pixels)
            </label>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Min Width</label>
                  <input
                    type="number"
                    value={filters.widthMin || ''}
                    onChange={(e) => onFilterChange('widthMin', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Max Width</label>
                  <input
                    type="number"
                    value={filters.widthMax || ''}
                    onChange={(e) => onFilterChange('widthMax', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="∞"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Min Height</label>
                  <input
                    type="number"
                    value={filters.heightMin || ''}
                    onChange={(e) => onFilterChange('heightMin', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Max Height</label>
                  <input
                    type="number"
                    value={filters.heightMax || ''}
                    onChange={(e) => onFilterChange('heightMax', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="∞"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 space-y-2">
        {hasActiveFilters() && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="w-full px-4 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center gap-2 transition-colors"
          >
            <Save size={16} />
            Save as Collection
          </button>
        )}
        <button
          onClick={onClear}
          className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Clear All Filters
        </button>
      </div>
    </div>

    {/* Save Collection Modal */}
    {showSaveModal && (
      <CreateCollectionModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSuccess={() => setShowSaveModal(false)}
        prefilledFilters={filters}
      />
    )}
    </>
  );
}
