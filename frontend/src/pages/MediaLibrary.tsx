import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { mediaApi, editorApi } from '../lib/api';
import { MediaFile, Editor } from '../types';
import { formatBytes, formatDate } from '../lib/utils';
import { Image as ImageIcon, Video, X } from 'lucide-react';

export function MediaLibraryPage() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEditor, setSelectedEditor] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedEditor, searchTerm]);

  const fetchData = async () => {
    try {
      const params: any = {};
      if (selectedEditor) params.editor_id = selectedEditor;
      if (searchTerm) params.search = searchTerm;

      const [filesRes, editorsRes] = await Promise.all([
        mediaApi.getAll(params),
        editorApi.getAll(),
      ]);

      console.log('Full files response:', filesRes.data);
      console.log('Files array:', filesRes.data.data.files);
      setFiles(filesRes.data.data.files || []);
      const editorsList = editorsRes.data.data || [];
      console.log('Fetched editors:', editorsList);
      setEditors(editorsList);
    } catch (error: any) {
      console.error('Failed to fetch media files:', error);
      console.error('Error response:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Media Library</h1>
            <p className="text-muted-foreground">Manage your creative assets</p>
          </div>
          <Button onClick={() => setShowUploadModal(true)}>
            Upload File
          </Button>
        </div>

        <div className="flex gap-4">
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <select
            value={selectedEditor}
            onChange={(e) => setSelectedEditor(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">All Editors</option>
            {editors.map((editor) => (
              <option key={editor.id} value={editor.id}>
                {editor.display_name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : files.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {files.map((file) => (
              <Card key={file.id} className="overflow-hidden">
                <div className="aspect-video bg-muted relative">
                  {file.thumbnail_url ? (
                    <img
                      src={file.thumbnail_url}
                      alt={file.original_filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      {file.file_type === 'image' ? (
                        <ImageIcon className="w-16 h-16 text-muted-foreground" />
                      ) : (
                        <Video className="w-16 h-16 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-background/80 backdrop-blur">
                      {file.file_type}
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-medium truncate" title={file.original_filename}>
                    {file.original_filename}
                  </h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Editor: {file.editor_name || 'N/A'}</p>
                    <p>Size: {formatBytes(file.file_size)}</p>
                    <p>Uploaded: {formatDate(file.created_at)}</p>
                  </div>
                  {file.tags && file.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {file.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs rounded-full bg-accent/20 text-accent-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No files found</p>
          </Card>
        )}
      </div>

      {showUploadModal && (
        <UploadModal
          editors={editors}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            fetchData();
          }}
        />
      )}
    </DashboardLayout>
  );
}

function UploadModal({
  editors,
  onClose,
  onSuccess,
}: {
  editors: Editor[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [editorId, setEditorId] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  console.log('UploadModal - Editors received:', editors.length, editors);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !editorId) {
      setError('Please select a file and editor');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean);
      await mediaApi.upload(file, editorId, tagArray, description);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Upload File</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">File</label>
            <Input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Editor {editors.length > 0 && `(${editors.length} available)`}
            </label>
            {editors.length === 0 ? (
              <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm">
                No editors found. Please add editors first in the Editors page.
              </div>
            ) : (
              <select
                value={editorId}
                onChange={(e) => setEditorId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                required
              >
                <option value="">Select editor...</option>
                {editors.map((editor) => (
                  <option key={editor.id} value={editor.id}>
                    {editor.display_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tags (comma-separated)</label>
            <Input
              placeholder="campaign, brand-a, product"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm min-h-[80px]"
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={uploading} className="flex-1">
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
