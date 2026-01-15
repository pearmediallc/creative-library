import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { teamApi } from '../lib/api';
import { Plus, Folder, Trash2, Edit2, Grid } from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  description?: string;
  collection_type: 'manual' | 'smart';
  team_id?: string;
  is_public: boolean;
  item_count?: number;
  created_at: string;
}

interface SmartCollectionsManagerProps {
  teamId?: string;
}

export function SmartCollectionsManager({ teamId }: SmartCollectionsManagerProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    collectionType: 'manual' as 'manual' | 'smart',
    isPublic: true
  });

  useEffect(() => {
    fetchCollections();
  }, [teamId]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError('');
      const params = teamId ? { teamId } : {};
      const response = await teamApi.getCollections(params);
      setCollections(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch collections:', err);
      setError(err.response?.data?.error || 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollection.name.trim()) {
      alert('Please enter a collection name');
      return;
    }

    try {
      await teamApi.createCollection({
        name: newCollection.name.trim(),
        description: newCollection.description.trim() || undefined,
        teamId: teamId,
        collectionType: newCollection.collectionType,
        isPublic: newCollection.isPublic
      });

      setShowCreateDialog(false);
      setNewCollection({
        name: '',
        description: '',
        collectionType: 'manual',
        isPublic: true
      });
      fetchCollections();
    } catch (err: any) {
      console.error('Failed to create collection:', err);
      alert(err.response?.data?.error || 'Failed to create collection');
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to delete this collection?')) {
      return;
    }

    try {
      await teamApi.deleteCollection(collectionId);
      fetchCollections();
    } catch (err: any) {
      console.error('Failed to delete collection:', err);
      alert(err.response?.data?.error || 'Failed to delete collection');
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p>{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Smart Collections</h2>
          <p className="text-muted-foreground">Organize and manage your media collections</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus size={16} className="mr-2" />
          New Collection
        </Button>
      </div>

      {/* Collections Grid */}
      {collections.length === 0 ? (
        <Card className="p-12 text-center">
          <Grid size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No collections yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first collection to organize your media files
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus size={16} className="mr-2" />
            Create Collection
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <Card key={collection.id} className="p-4 hover:shadow-lg transition-all">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <Folder size={20} className="text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{collection.name}</h3>
                  {collection.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {collection.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span>{collection.item_count || 0} items</span>
                    <span className="capitalize">{collection.collection_type}</span>
                    {collection.is_public && <span>Public</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDeleteCollection(collection.id)}
                >
                  <Trash2 size={14} className="mr-1" />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Collection Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 m-4">
            <h3 className="text-xl font-semibold mb-4">Create New Collection</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Collection Name *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newCollection.name}
                  onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                  placeholder="Enter collection name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newCollection.description}
                  onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Collection Type
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={newCollection.collectionType}
                  onChange={(e) => setNewCollection({ ...newCollection, collectionType: e.target.value as 'manual' | 'smart' })}
                >
                  <option value="manual">Manual</option>
                  <option value="smart">Smart</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={newCollection.isPublic}
                  onChange={(e) => setNewCollection({ ...newCollection, isPublic: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isPublic" className="text-sm">
                  Make this collection public
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewCollection({
                    name: '',
                    description: '',
                    collectionType: 'manual',
                    isPublic: true
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateCollection}
              >
                Create
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
