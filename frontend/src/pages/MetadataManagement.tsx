import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Tags, Plus, Search, Edit2, Trash2, Save, X } from 'lucide-react';

interface MetadataTag {
  id: string;
  name: string;
  category: string;
  usageCount: number;
  createdAt: string;
}

export function MetadataManagement() {
  const [tags, setTags] = useState<MetadataTag[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTag, setEditingTag] = useState<MetadataTag | null>(null);
  const [newTag, setNewTag] = useState({ name: '', category: 'general' });

  const categories = ['all', 'general', 'campaign', 'product', 'location', 'custom'];

  // Mock data for demonstration
  useEffect(() => {
    // TODO: Fetch from API
    setTags([
      { id: '1', name: 'auto insurance', category: 'campaign', usageCount: 45, createdAt: '2024-01-01' },
      { id: '2', name: 'refi', category: 'campaign', usageCount: 32, createdAt: '2024-01-05' },
      { id: '3', name: 'summer sale', category: 'campaign', usageCount: 28, createdAt: '2024-01-10' },
      { id: '4', name: 'product launch', category: 'product', usageCount: 15, createdAt: '2024-01-15' },
    ]);
  }, []);

  const filteredTags = tags.filter(tag => {
    const matchesSearch = tag.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || tag.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddTag = () => {
    if (newTag.name.trim()) {
      const tag: MetadataTag = {
        id: String(Date.now()),
        name: newTag.name.trim(),
        category: newTag.category,
        usageCount: 0,
        createdAt: new Date().toISOString(),
      };
      setTags([...tags, tag]);
      setNewTag({ name: '', category: 'general' });
      setShowAddModal(false);
      // TODO: Save to API
    }
  };

  const handleUpdateTag = () => {
    if (editingTag) {
      setTags(tags.map(t => t.id === editingTag.id ? editingTag : t));
      setEditingTag(null);
      // TODO: Update via API
    }
  };

  const handleDeleteTag = (id: string) => {
    if (window.confirm('Delete this tag? This will remove it from all associated files.')) {
      setTags(tags.filter(t => t.id !== id));
      // TODO: Delete via API
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Metadata Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage tags and metadata for your media library
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add New Tag
          </button>
        </div>

        {/* Search and Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Tags</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{tags.length}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">Campaign Tags</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">
              {tags.filter(t => t.category === 'campaign').length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">Product Tags</div>
            <div className="text-3xl font-bold text-green-600 mt-2">
              {tags.filter(t => t.category === 'product').length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Usage</div>
            <div className="text-3xl font-bold text-purple-600 mt-2">
              {tags.reduce((sum, t) => sum + t.usageCount, 0)}
            </div>
          </div>
        </div>

        {/* Tags Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tag Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Usage Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTags.map(tag => (
                <tr key={tag.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingTag?.id === tag.id ? (
                      <input
                        type="text"
                        value={editingTag.name}
                        onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Tags size={16} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{tag.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingTag?.id === tag.id ? (
                      <select
                        value={editingTag.category}
                        onChange={(e) => setEditingTag({ ...editingTag, category: e.target.value })}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                      >
                        {categories.filter(c => c !== 'all').map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {tag.category}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {tag.usageCount} files
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(tag.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editingTag?.id === tag.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleUpdateTag}
                          className="text-green-600 hover:text-green-900 dark:hover:text-green-400"
                        >
                          <Save size={18} />
                        </button>
                        <button
                          onClick={() => setEditingTag(null)}
                          className="text-gray-600 hover:text-gray-900 dark:hover:text-gray-400"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingTag(tag)}
                          className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Tag Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add New Tag</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tag Name
                  </label>
                  <input
                    type="text"
                    value={newTag.name}
                    onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                    placeholder="Enter tag name..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newTag.category}
                    onChange={(e) => setNewTag({ ...newTag, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    {categories.filter(c => c !== 'all').map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Tag
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
