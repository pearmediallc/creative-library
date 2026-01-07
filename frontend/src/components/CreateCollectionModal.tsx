import React, { useState, useEffect } from 'react';
import { X, Folder, Star, Image, Video, Tag, Calendar, Filter, Layers, Eye } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { savedSearchApi, editorApi, adminApi, mediaApi } from '../lib/api';
import { MediaFilters } from '../hooks/useMediaFilters';
import { useAuth } from '../contexts/AuthContext';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingCollection?: any;
  prefilledFilters?: MediaFilters;
}

const ICONS = [
  { name: 'Folder', icon: Folder },
  { name: 'Star', icon: Star },
  { name: 'Image', icon: Image },
  { name: 'Video', icon: Video },
  { name: 'Tag', icon: Tag },
  { name: 'Calendar', icon: Calendar },
  { name: 'Filter', icon: Filter },
  { name: 'Layers', icon: Layers },
];

const COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // green
  '#06B6D4', // cyan
  '#6366F1', // indigo
];

export function CreateCollectionModal({
  isOpen,
  onClose,
  onSuccess,
  editingCollection,
  prefilledFilters
}: CreateCollectionModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Folder');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [mediaTypes, setMediaTypes] = useState<string[]>([]);
  const [selectedEditors, setSelectedEditors] = useState<string[]>([]);
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isStarred, setIsStarred] = useState<boolean | undefined>(undefined);

  // Data for dropdowns
  const [editors, setEditors] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchData();

      if (editingCollection) {
        // Populate form with existing collection data
        setName(editingCollection.name || '');
        setDescription(editingCollection.description || '');
        setSelectedIcon(editingCollection.icon || 'Folder');
        setSelectedColor(editingCollection.color || COLORS[0]);

        const filters = editingCollection.filters || {};
        setSearchTerm(filters.search_term || '');
        setDateFrom(filters.date_from || '');
        setDateTo(filters.date_to || '');
        setMediaTypes(filters.media_types || []);
        setSelectedEditors(filters.editor_ids || []);
        setSelectedBuyers(filters.buyer_ids || []);
        setSelectedFolders(filters.folder_ids || []);
        setSelectedTags(filters.tags || []);
        setIsStarred(filters.is_starred);
      } else if (prefilledFilters) {
        // Populate from prefilled filters
        setSearchTerm(prefilledFilters.search || '');
        setDateFrom(prefilledFilters.dateFrom?.toISOString().split('T')[0] || '');
        setDateTo(prefilledFilters.dateTo?.toISOString().split('T')[0] || '');
        setMediaTypes(prefilledFilters.mediaTypes || []);
        setSelectedEditors(prefilledFilters.editorIds || []);
        setSelectedBuyers(prefilledFilters.buyerIds || []);
        setSelectedFolders(prefilledFilters.folderIds || []);
        setSelectedTags(prefilledFilters.tags || []);
      }
    }
  }, [isOpen, editingCollection, prefilledFilters]);

  const fetchData = async () => {
    try {
      // Fetch editors
      const editorsRes = await editorApi.getAll();
      setEditors(editorsRes.data.data || []);

      // Fetch buyers (admin only)
      if (isAdmin) {
        const usersRes = await adminApi.getUsers();
        const allUsers = usersRes.data.data || [];
        const buyerUsers = allUsers.filter((u: any) => u.role === 'buyer');
        setBuyers(buyerUsers);
      }

      // Fetch folders (simplified - you may have a dedicated endpoint)
      // For now, we'll skip this or fetch from a tree endpoint

      // Fetch available tags
      const filesRes = await mediaApi.getAll({});
      const allFiles = filesRes.data.data.files || [];
      const tags = new Set<string>();
      allFiles.forEach((file: any) => {
        if (file.tags && Array.isArray(file.tags)) {
          file.tags.forEach((tag: string) => tags.add(tag));
        }
      });
      setAvailableTags(Array.from(tags).sort());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      const filters = buildFilters();

      // Convert filters to query params
      const params: any = {};
      if (filters.search_term) params.search = filters.search_term;
      if (filters.media_types?.length) params.media_type = filters.media_types.join(',');
      if (filters.editor_ids?.length) params.editor_id = filters.editor_ids.join(',');
      if (filters.buyer_ids?.length) params.buyer_id = filters.buyer_ids.join(',');
      if (filters.folder_ids?.length) params.folder_id = filters.folder_ids.join(',');
      if (filters.tags?.length) params.tags = filters.tags.join(',');
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const response = await mediaApi.getAll(params);
      setPreviewCount(response.data.data.total || 0);
    } catch (error) {
      console.error('Failed to preview:', error);
      setPreviewCount(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const buildFilters = () => {
    const filters: any = {};

    if (searchTerm) filters.search_term = searchTerm;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (mediaTypes.length > 0) filters.media_types = mediaTypes;
    if (selectedEditors.length > 0) filters.editor_ids = selectedEditors;
    if (selectedBuyers.length > 0) filters.buyer_ids = selectedBuyers;
    if (selectedFolders.length > 0) filters.folder_ids = selectedFolders;
    if (selectedTags.length > 0) filters.tags = selectedTags;
    if (isStarred !== undefined) filters.is_starred = isStarred;

    return filters;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter a collection name');
      return;
    }

    try {
      setLoading(true);
      const filters = buildFilters();

      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        filters,
        icon: selectedIcon,
        color: selectedColor
      };

      if (editingCollection) {
        await savedSearchApi.update(editingCollection.id, data);
      } else {
        await savedSearchApi.create(data);
      }

      onSuccess();
    } catch (error: any) {
      console.error('Failed to save collection:', error);
      alert(error.response?.data?.error || 'Failed to save collection');
    } finally {
      setLoading(false);
    }
  };

  const toggleArrayValue = (arr: string[], value: string, setter: (arr: string[]) => void) => {
    if (arr.includes(value)) {
      setter(arr.filter(v => v !== value));
    } else {
      setter([...arr, value]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {editingCollection ? 'Edit Collection' : 'Create Smart Collection'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collection Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Collection"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Icon & Color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Icon
              </label>
              <div className="grid grid-cols-4 gap-2">
                {ICONS.map(({ name, icon: Icon }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedIcon(name)}
                    className={`p-3 rounded-lg border-2 flex items-center justify-center transition ${
                      selectedIcon === name
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <Icon size={20} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <div className="grid grid-cols-4 gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`h-10 rounded-lg border-2 transition ${
                      selectedColor === color
                        ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-gray-900 dark:ring-white'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Filters Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Filter Criteria
            </h3>

            {/* Search Term */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Term
              </label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Keywords..."
              />
            </div>

            {/* Date Range */}
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Media Types */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Media Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mediaTypes.includes('image')}
                    onChange={() => toggleArrayValue(mediaTypes, 'image', setMediaTypes)}
                    className="rounded"
                  />
                  <span className="text-sm">Images</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mediaTypes.includes('video')}
                    onChange={() => toggleArrayValue(mediaTypes, 'video', setMediaTypes)}
                    className="rounded"
                  />
                  <span className="text-sm">Videos</span>
                </label>
              </div>
            </div>

            {/* Editors */}
            {editors.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Editors
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-2">
                  {editors.map((editor) => (
                    <label key={editor.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEditors.includes(editor.id)}
                        onChange={() => toggleArrayValue(selectedEditors, editor.id, setSelectedEditors)}
                        className="rounded"
                      />
                      <span className="text-sm">{editor.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Buyers */}
            {buyers.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assigned Buyers
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-2">
                  {buyers.map((buyer) => (
                    <label key={buyer.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBuyers.includes(buyer.id)}
                        onChange={() => toggleArrayValue(selectedBuyers, buyer.id, setSelectedBuyers)}
                        className="rounded"
                      />
                      <span className="text-sm">{buyer.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {availableTags.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-2">
                  {availableTags.map((tag) => (
                    <label key={tag} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={() => toggleArrayValue(selectedTags, tag, setSelectedTags)}
                        className="rounded"
                      />
                      <span className="text-sm">{tag}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Starred */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Starred Files
              </label>
              <select
                value={isStarred === undefined ? '' : isStarred ? 'true' : 'false'}
                onChange={(e) => setIsStarred(e.target.value === '' ? undefined : e.target.value === 'true')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Files</option>
                <option value="true">Starred Only</option>
                <option value="false">Not Starred</option>
              </select>
            </div>

            {/* Preview Button */}
            <Button
              type="button"
              variant="secondary"
              onClick={handlePreview}
              disabled={previewLoading}
              className="w-full"
            >
              <Eye size={16} className="mr-2" />
              {previewLoading ? 'Loading...' : 'Preview Results'}
            </Button>

            {previewCount !== null && (
              <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
                {previewCount} file{previewCount !== 1 ? 's' : ''} match this filter
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : editingCollection ? 'Update Collection' : 'Create Collection'}
          </Button>
        </div>
      </div>
    </div>
  );
}
