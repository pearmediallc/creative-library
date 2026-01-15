import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { teamApi } from '../lib/api';
import { FolderPlus, X } from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  description?: string;
  collection_type: 'manual' | 'smart';
  item_count?: number;
}

interface AddToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileRequestUploadId: string;
  teamId?: string;
}

export function AddToCollectionModal({
  isOpen,
  onClose,
  fileRequestUploadId,
  teamId
}: AddToCollectionModalProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCollections();
    }
  }, [isOpen, teamId]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const params = teamId ? { teamId } : {};
      const response = await teamApi.getCollections(params);
      setCollections(response.data.data || []);
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
      await teamApi.addItemToCollection(selectedCollectionId, {
        fileRequestUploadId
      });
      alert('Added to collection successfully');
      onClose();
    } catch (err: any) {
      console.error('Failed to add to collection:', err);
      alert(err.response?.data?.error || 'Failed to add to collection');
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Add to Collection</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-8">
            <FolderPlus size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-muted-foreground mb-4">No collections available</p>
            <p className="text-sm text-muted-foreground">
              Create a collection first to organize your media
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Collection
              </label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
              >
                <option value="">Choose a collection...</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name} ({collection.item_count || 0} items)
                  </option>
                ))}
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
