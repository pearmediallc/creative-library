import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { teamApi, savedSearchApi } from '../lib/api';
import { FolderPlus, X, Users, User } from 'lucide-react';

interface TeamCollection {
  id: string;
  name: string;
  description?: string;
  collection_type: 'manual' | 'smart';
  item_count?: number;
  team_id?: string;
}

interface PersonalCollection {
  id: string;
  name: string;
  description?: string;
  filters: any;
  file_count?: number;
}

interface AddToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileRequestUploadId: string;
  teamId?: string;
}

type CollectionType = 'personal' | 'team';

export function AddToCollectionModal({
  isOpen,
  onClose,
  fileRequestUploadId,
  teamId
}: AddToCollectionModalProps) {
  const [collectionType, setCollectionType] = useState<CollectionType>('personal');
  const [teamCollections, setTeamCollections] = useState<TeamCollection[]>([]);
  const [personalCollections, setPersonalCollections] = useState<PersonalCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCollections();
    }
  }, [isOpen, collectionType, teamId]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      if (collectionType === 'team') {
        const params = teamId ? { teamId } : {};
        const response = await teamApi.getCollections(params);
        setTeamCollections(response.data.data || []);
      } else {
        const response = await savedSearchApi.getAll();
        setPersonalCollections(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch collections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCollection = async () => {
    if (!selectedCollectionId) {
      alert('Please select a collection');
      return;
    }

    try {
      setAdding(true);

      if (collectionType === 'team') {
        await teamApi.addItemToCollection(selectedCollectionId, {
          fileRequestUploadId
        });
        alert('Added to team collection successfully');
      } else {
        // For personal collections: Add file ID to the collection's manual file list
        // We'll use the savedSearchApi to update the collection with the file ID
        const collection = personalCollections.find(c => c.id === selectedCollectionId);
        if (collection) {
          // Get current filters
          const currentFilters = collection.filters || {};

          // Add file ID to manual_file_ids array
          const manualFileIds = currentFilters.manual_file_ids || [];
          if (!manualFileIds.includes(fileRequestUploadId)) {
            manualFileIds.push(fileRequestUploadId);
          }

          // Update the collection with new filters
          await savedSearchApi.update(selectedCollectionId, {
            filters: {
              ...currentFilters,
              manual_file_ids: manualFileIds
            }
          });
          alert('Added to personal collection successfully');
        }
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to add to collection:', err);
      alert(err.response?.data?.error || 'Failed to add to collection');
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  const collections = collectionType === 'team' ? teamCollections : personalCollections;
  const hasCollections = collections.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Add to Collection</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Collection Type Tabs */}
        <div className="flex gap-2 mb-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <button
            onClick={() => {
              setCollectionType('personal');
              setSelectedCollectionId('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
              collectionType === 'personal'
                ? 'bg-white dark:bg-gray-700 shadow-sm text-primary font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <User size={16} />
            Personal Collections
          </button>
          <button
            onClick={() => {
              setCollectionType('team');
              setSelectedCollectionId('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
              collectionType === 'team'
                ? 'bg-white dark:bg-gray-700 shadow-sm text-primary font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Users size={16} />
            Team Collections
          </button>
        </div>

        {/* Collection Type Description */}
        <p className="text-sm text-muted-foreground mb-4">
          {collectionType === 'personal'
            ? 'Your personal smart collections based on saved search filters'
            : 'Team collections shared with your team members'
          }
        </p>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !hasCollections ? (
          <div className="text-center py-8">
            <FolderPlus size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-muted-foreground mb-4">
              No {collectionType === 'personal' ? 'personal' : 'team'} collections available
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Create a collection first to organize your media
            </p>
            <Button
              onClick={() => {
                window.location.href = '/collections';
              }}
            >
              Go to Collections
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Collection
              </label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 dark:border-gray-700"
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
              >
                <option value="">Choose a collection...</option>
                {collectionType === 'team'
                  ? teamCollections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name} ({collection.item_count || 0} items)
                      </option>
                    ))
                  : personalCollections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name} ({collection.file_count || 0} files)
                      </option>
                    ))
                }
              </select>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={adding}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddToCollection}
                disabled={adding || !selectedCollectionId}
              >
                {adding ? 'Adding...' : 'Add to Collection'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
