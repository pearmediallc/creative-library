import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { editorApi } from '../lib/api';
import { Editor } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, Edit2, Check, X, Trash2 } from 'lucide-react';

export function EditorsPage() {
  const [editors, setEditors] = useState<Editor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', display_name: '' });
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchEditors();
  }, []);

  const fetchEditors = async () => {
    try {
      const response = await editorApi.getAll(true); // Pass true to include stats
      setEditors(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch editors:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.name) {
      setError('Name is required');
      return;
    }

    try {
      await editorApi.create({
        name: formData.name,
        display_name: formData.display_name || formData.name,
      });
      setFormData({ name: '', display_name: '' });
      setShowAddForm(false);
      setError('');
      fetchEditors();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create editor');
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await editorApi.update(id, {
        display_name: formData.display_name,
      });
      setEditingId(null);
      setFormData({ name: '', display_name: '' });
      fetchEditors();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update editor');
    }
  };

  const startEdit = (editor: Editor) => {
    setEditingId(editor.id);
    setFormData({ name: editor.name, display_name: editor.display_name });
  };

  const handleDelete = async (id: string, displayName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${displayName}"? This will deactivate the editor.`)) {
      return;
    }

    try {
      await editorApi.delete(id);
      fetchEditors();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete editor');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading editors...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Editors</h1>
            <p className="text-muted-foreground">Manage creative team members</p>
          </div>
          {user?.role === 'admin' && (
            <Button onClick={() => setShowAddForm(!showAddForm)}>
              <Plus size={16} className="mr-2" />
              Add Editor
            </Button>
          )}
        </div>

        {/* Add Editor Form */}
        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add New Editor</CardTitle>
              <CardDescription>Create a new editor profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name (uppercase, used in ad names)</label>
                  <Input
                    placeholder="e.g., JOHNSMITH"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Name</label>
                  <Input
                    placeholder="e.g., John Smith"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAdd}>Create Editor</Button>
                  <Button variant="outline" onClick={() => {
                    setShowAddForm(false);
                    setFormData({ name: '', display_name: '' });
                    setError('');
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Editors List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {editors.map((editor) => (
            <Card key={editor.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users size={24} className="text-primary" />
                    </div>
                    <div>
                      {editingId === editor.id ? (
                        <Input
                          value={formData.display_name}
                          onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                          className="h-8 text-sm"
                        />
                      ) : (
                        <>
                          <CardTitle className="text-lg">{editor.display_name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{editor.name}</p>
                        </>
                      )}
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <div className="flex gap-1">
                      {editingId === editor.id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(editor.id)}
                            className="p-1 hover:bg-accent rounded"
                          >
                            <Check size={16} className="text-primary" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setFormData({ name: '', display_name: '' });
                            }}
                            className="p-1 hover:bg-accent rounded"
                          >
                            <X size={16} className="text-muted-foreground" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(editor)}
                            className="p-1 hover:bg-accent rounded"
                            title="Edit editor"
                          >
                            <Edit2 size={16} className="text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(editor.id, editor.display_name)}
                            className="p-1 hover:bg-red-50 rounded"
                            title="Delete editor"
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Media Files:</span>
                    <span className="font-medium">{editor.media_file_count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ads:</span>
                    <span className="font-medium">{editor.ad_count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Spend:</span>
                    <span className="font-medium">${Math.round(editor.total_spend || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className={editor.is_active ? 'text-primary' : 'text-muted-foreground'}>
                      {editor.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {editors.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No editors found</p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
