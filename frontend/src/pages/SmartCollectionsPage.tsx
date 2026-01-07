import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { savedSearchApi } from '../lib/api';
import { Layers, Plus, Star, Trash2, Edit, Eye, Folder, Image, Video, Tag, Calendar, Filter } from 'lucide-react';
import { CreateCollectionModal } from '../components/CreateCollectionModal';

interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  filters: any;
  is_favorite: boolean;
  color?: string;
  icon?: string;
  file_count?: number;
  created_at: string;
  updated_at: string;
}

const ICON_MAP: Record<string, any> = {
  Folder: Folder,
  Star: Star,
  Image: Image,
  Video: Video,
  Tag: Tag,
  Calendar: Calendar,
  Filter: Filter,
  Layers: Layers,
};

export function SmartCollectionsPage() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<SavedSearch | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const response = await savedSearchApi.getAll();
      setCollections(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = () => {
    setEditingCollection(null);
    setShowCreateModal(true);
  };

  const handleEditCollection = (collection: SavedSearch) => {
    setEditingCollection(collection);
    setShowCreateModal(true);
  };

  const handleViewCollection = (collection: SavedSearch) => {
    // Navigate to media library with filters applied
    const filters = collection.filters;
    const params = new URLSearchParams();

    if (filters.search_term) params.set('search', filters.search_term);
    if (filters.media_types?.length) params.set('media_type', filters.media_types.join(','));
    if (filters.editor_ids?.length) params.set('editor_id', filters.editor_ids.join(','));
    if (filters.buyer_ids?.length) params.set('buyer_id', filters.buyer_ids.join(','));
    if (filters.folder_ids?.length) params.set('folder_id', filters.folder_ids.join(','));
    if (filters.tags?.length) params.set('tags', filters.tags.join(','));
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);

    navigate(`/media?${params.toString()}&collection=${collection.id}&collection_name=${encodeURIComponent(collection.name)}`);
  };

  const handleToggleFavorite = async (e: React.MouseEvent, collection: SavedSearch) => {
    e.stopPropagation();
    try {
      await savedSearchApi.toggleFavorite(collection.id);
      fetchCollections();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    try {
      await savedSearchApi.delete(collectionId);
      setDeleteConfirmId(null);
      fetchCollections();
    } catch (error) {
      console.error('Failed to delete collection:', error);
    }
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    setEditingCollection(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchCollections();
  };

  const favoriteCollections = collections.filter(c => c.is_favorite);
  const regularCollections = collections.filter(c => !c.is_favorite);

  const getFilterSummary = (filters: any) => {
    const parts: string[] = [];
    if (filters.media_types?.length) parts.push(`${filters.media_types.length} media type(s)`);
    if (filters.editor_ids?.length) parts.push(`${filters.editor_ids.length} editor(s)`);
    if (filters.buyer_ids?.length) parts.push(`${filters.buyer_ids.length} buyer(s)`);
    if (filters.tags?.length) parts.push(`${filters.tags.length} tag(s)`);
    if (filters.date_from || filters.date_to) parts.push('date range');
    if (filters.search_term) parts.push('search term');

    return parts.length > 0 ? parts.join(' • ') : 'No filters';
  };

  const renderCollectionCard = (collection: SavedSearch) => {
    const IconComponent = ICON_MAP[collection.icon || 'Folder'] || Folder;
    const bgColor = collection.color || '#3B82F6';

    return (
      <Card
        key={collection.id}
        className="p-6 hover:shadow-lg transition-shadow cursor-pointer relative"
        onClick={() => handleViewCollection(collection)}
      >
        {/* Delete Confirmation Overlay */}
        {deleteConfirmId === collection.id && (
          <div
            className="absolute inset-0 bg-white dark:bg-gray-800 z-10 flex flex-col items-center justify-center p-4 rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center mb-4 text-gray-900 dark:text-white">
              Delete "{collection.name}"?
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCollection(collection.id);
                }}
              >
                Delete
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirmId(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Favorite Star */}
        <button
          onClick={(e) => handleToggleFavorite(e, collection)}
          className="absolute top-4 right-4 z-20"
        >
          <Star
            size={20}
            className={
              collection.is_favorite
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }
          />
        </button>

        {/* Icon */}
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
          style={{ backgroundColor: bgColor + '20' }}
        >
          <IconComponent size={24} style={{ color: bgColor }} />
        </div>

        {/* Name & Description */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {collection.name}
        </h3>
        {collection.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {collection.description}
          </p>
        )}

        {/* Filter Summary */}
        <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
          {getFilterSummary(collection.filters)}
        </p>

        {/* File Count Badge */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {collection.file_count || 0} files
          </span>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewCollection(collection);
              }}
              className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="View"
            >
              <Eye size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditCollection(collection);
              }}
              className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Edit"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirmId(collection.id);
              }}
              className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers size={32} className="text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Smart Collections
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Save and organize your search filters
              </p>
            </div>
          </div>
          <Button onClick={handleCreateCollection}>
            <Plus size={20} className="mr-2" />
            Create Collection
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Loading collections...</p>
          </div>
        ) : collections.length === 0 ? (
          <Card className="p-12 text-center">
            <Layers size={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Collections Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first smart collection to save and organize your search filters
            </p>
            <Button onClick={handleCreateCollection}>
              <Plus size={20} className="mr-2" />
              Create Your First Collection
            </Button>
          </Card>
        ) : (
          <>
            {/* Favorites Section */}
            {favoriteCollections.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Star size={20} className="text-yellow-500 fill-yellow-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Favorites
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favoriteCollections.map(renderCollectionCard)}
                </div>
              </div>
            )}

            {/* All Collections */}
            {regularCollections.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  All Collections
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regularCollections.map(renderCollectionCard)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CreateCollectionModal
          isOpen={showCreateModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          editingCollection={editingCollection}
        />
      )}
    </DashboardLayout>
  );
}
