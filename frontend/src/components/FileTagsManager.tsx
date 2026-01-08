import React, { useState, useEffect } from 'react';
import { X, Tag, Plus, Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { metadataTagApi } from '../lib/api';

interface MetadataTag {
  id: string;
  name: string;
  category?: string;
  description?: string;
  usage_count?: number;
  created_at: string;
}

interface FileTagsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  mediaId: string;
  fileName: string;
  onTagsUpdated?: () => void;
}

export function FileTagsManager({
  isOpen,
  onClose,
  mediaId,
  fileName,
  onTagsUpdated
}: FileTagsManagerProps) {
  const [allTags, setAllTags] = useState<MetadataTag[]>([]);
  const [fileTags, setFileTags] = useState<MetadataTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagCategory, setNewTagCategory] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processingTagIds, setProcessingTagIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, mediaId]);

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch all available tags and current file tags in parallel
      const [allTagsRes, fileTagsRes, categoriesRes] = await Promise.all([
        metadataTagApi.getAll(),
        metadataTagApi.getFileTags(mediaId),
        metadataTagApi.getCategories()
      ]);

      setAllTags(allTagsRes.data.data || []);
      setFileTags(fileTagsRes.data.data || []);
      setCategories(categoriesRes.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch tags:', err);
      setError(err.response?.data?.error || 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    setProcessingTagIds(prev => new Set(prev).add(tagId));
    setError('');
    setSuccess('');

    try {
      await metadataTagApi.addTagToFile(mediaId, tagId);

      // Update local state
      const addedTag = allTags.find(t => t.id === tagId);
      if (addedTag) {
        setFileTags(prev => [...prev, addedTag]);
      }

      setSuccess('Tag added successfully');
      setTimeout(() => setSuccess(''), 2000);

      if (onTagsUpdated) {
        onTagsUpdated();
      }
    } catch (err: any) {
      console.error('Failed to add tag:', err);
      setError(err.response?.data?.error || 'Failed to add tag');
    } finally {
      setProcessingTagIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(tagId);
        return newSet;
      });
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    setProcessingTagIds(prev => new Set(prev).add(tagId));
    setError('');
    setSuccess('');

    try {
      await metadataTagApi.removeTagFromFile(mediaId, tagId);

      // Update local state
      setFileTags(prev => prev.filter(t => t.id !== tagId));

      setSuccess('Tag removed successfully');
      setTimeout(() => setSuccess(''), 2000);

      if (onTagsUpdated) {
        onTagsUpdated();
      }
    } catch (err: any) {
      console.error('Failed to remove tag:', err);
      setError(err.response?.data?.error || 'Failed to remove tag');
    } finally {
      setProcessingTagIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(tagId);
        return newSet;
      });
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTagName.trim()) {
      setError('Tag name is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const response = await metadataTagApi.create({
        name: newTagName.trim(),
        category: newTagCategory.trim() || undefined,
        description: newTagDescription.trim() || undefined
      });

      const createdTag = response.data.data;

      // Update all tags list
      setAllTags(prev => [...prev, createdTag]);

      // Add the new tag to categories if it's new
      if (newTagCategory.trim() && !categories.includes(newTagCategory.trim())) {
        setCategories(prev => [...prev, newTagCategory.trim()]);
      }

      // Automatically add the newly created tag to the file
      await handleAddTag(createdTag.id);

      // Reset form
      setNewTagName('');
      setNewTagCategory('');
      setNewTagDescription('');
      setShowCreateTag(false);
      setSuccess('Tag created and added successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      console.error('Failed to create tag:', err);
      setError(err.response?.data?.error || 'Failed to create tag');
    } finally {
      setCreating(false);
    }
  };

  const isTagAttached = (tagId: string) => {
    return fileTags.some(t => t.id === tagId);
  };

  // Filter tags based on search and category
  const filteredTags = allTags.filter(tag => {
    const matchesSearch = tag.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || tag.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Separate attached and available tags
  const attachedTags = filteredTags.filter(tag => isTagAttached(tag.id));
  const availableTags = filteredTags.filter(tag => !isTagAttached(tag.id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Manage Tags
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Messages */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {/* Current Tags */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Current Tags ({fileTags.length})
                </h3>
                {fileTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {fileTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span className="text-sm font-medium">{tag.name}</span>
                        {tag.category && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            ({tag.category})
                          </span>
                        )}
                        <button
                          onClick={() => handleRemoveTag(tag.id)}
                          disabled={processingTagIds.has(tag.id)}
                          className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 disabled:opacity-50"
                        >
                          {processingTagIds.has(tag.id) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No tags attached. Add tags from the available tags below.
                  </p>
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                {/* Search and Filters */}
                <div className="flex gap-3 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search tags..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
                  >
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Create New Tag Button */}
                {!showCreateTag && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateTag(true)}
                    className="mb-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Tag
                  </Button>
                )}

                {/* Create Tag Form */}
                {showCreateTag && (
                  <form onSubmit={handleCreateTag} className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Create New Tag</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateTag(false);
                          setNewTagName('');
                          setNewTagCategory('');
                          setNewTagDescription('');
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tag Name *
                      </label>
                      <Input
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="e.g., Campaign 2024"
                        disabled={creating}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Category (optional)
                        </label>
                        <Input
                          value={newTagCategory}
                          onChange={(e) => setNewTagCategory(e.target.value)}
                          placeholder="e.g., Campaign"
                          disabled={creating}
                          list="categories-list"
                        />
                        <datalist id="categories-list">
                          {categories.map((cat) => (
                            <option key={cat} value={cat} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description (optional)
                        </label>
                        <Input
                          value={newTagDescription}
                          onChange={(e) => setNewTagDescription(e.target.value)}
                          placeholder="Brief description"
                          disabled={creating}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={creating || !newTagName.trim()}
                      >
                        {creating ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3 mr-2" />
                            Create & Add
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCreateTag(false);
                          setNewTagName('');
                          setNewTagCategory('');
                          setNewTagDescription('');
                        }}
                        disabled={creating}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {/* Available Tags */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Available Tags ({availableTags.length})
                  </h3>
                  {availableTags.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {availableTags.map((tag) => (
                        <div
                          key={tag.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Tag className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {tag.name}
                              </span>
                              {tag.category && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                  {tag.category}
                                </span>
                              )}
                              {tag.usage_count !== undefined && tag.usage_count > 0 && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  ({tag.usage_count} files)
                                </span>
                              )}
                            </div>
                            {tag.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                                {tag.description}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddTag(tag.id)}
                            disabled={processingTagIds.has(tag.id)}
                          >
                            {processingTagIds.has(tag.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Plus className="w-3 h-3 mr-1" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {searchTerm || selectedCategory
                        ? 'No tags found matching your search.'
                        : 'No more tags available. Create a new tag above.'}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
