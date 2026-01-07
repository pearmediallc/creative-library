import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { mediaApi, editorApi } from '../lib/api';
import { MediaFile, Editor } from '../types';
import { formatBytes, formatDate } from '../lib/utils';
import { Image as ImageIcon, Video, X, Download, Trash2, Info, PackageOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BulkMetadataEditor } from '../components/BulkMetadataEditor';
import { MetadataViewer } from '../components/MetadataViewer';

export function MediaLibraryPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEditor, setSelectedEditor] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const filesPerPage = 12;

  // ✨ NEW: Bulk editor state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showBulkEditor, setShowBulkEditor] = useState(false);

  // ✨ NEW: Metadata viewer state
  const [metadataViewerFile, setMetadataViewerFile] = useState<{
    id: string;
    filename: string;
    metadata: Record<string, any>;
  } | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Role-based permissions
  const isAdmin = user?.role === 'admin';
  const canUpload = user?.role === 'admin' || user?.role === 'creative';
  const canDelete = user?.role === 'admin';

  useEffect(() => {
    fetchData();
    setCurrentPage(1); // Reset to page 1 when filters change
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

  const handleDownload = async (file: MediaFile) => {
    try {
      const url = file.s3_url || file.download_url;
      if (!url) return;

      // Create temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await mediaApi.delete(fileId);
      setDeleteConfirmId(null);
      fetchData();
    } catch (error: any) {
      console.error('Delete failed:', error);
      alert(error.response?.data?.error || 'Failed to delete file');
    }
  };

  // ✨ NEW: Toggle file selection
  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  // ✨ NEW: Toggle select all
  const toggleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.id));
    }
  };

  // ✨ NEW: View file metadata
  const handleViewMetadata = async (file: MediaFile) => {
    try {
      const response = await mediaApi.extractMetadata(file.id);
      setMetadataViewerFile({
        id: file.id,
        filename: file.original_filename,
        metadata: response.data.data.metadata || {},
      });
    } catch (error: any) {
      console.error('Failed to extract metadata:', error);
      alert(error.response?.data?.error || 'Failed to extract metadata');
    }
  };

  // ✨ NEW: Download selected files as ZIP
  const handleBulkDownloadZip = async () => {
    if (selectedFiles.length === 0) return;

    setDownloadingZip(true);
    try {
      const response = await mediaApi.bulkDownloadZip(selectedFiles);

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `creative-library-files-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Failed to download ZIP:', error);
      alert(error.response?.data?.error || 'Failed to download files');
    } finally {
      setDownloadingZip(false);
    }
  };

  const selectedFileObjects = files.filter(f => selectedFiles.includes(f.id));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Media Library</h1>
            <p className="text-muted-foreground">Manage your creative assets</p>
          </div>
          {canUpload && (
            <div className="flex gap-2">
              <Button onClick={() => setShowUploadModal(true)}>
                Upload File
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedFiles([]);
                }}
              >
                {selectionMode ? 'Cancel Selection' : 'Bulk Edit'}
              </Button>
              {selectionMode && selectedFiles.length > 0 && (
                <>
                  <Button onClick={() => setShowBulkEditor(true)}>
                    Edit {selectedFiles.length} Selected
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleBulkDownloadZip}
                    disabled={downloadingZip}
                  >
                    <PackageOpen className="w-4 h-4 mr-2" />
                    {downloadingZip ? 'Creating ZIP...' : `Download ${selectedFiles.length} as ZIP`}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {selectionMode && (
          <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedFiles.length === files.length && files.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">
                Select All ({selectedFiles.length} / {files.length})
              </span>
            </label>
          </div>
        )}

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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(() => {
                const totalPages = Math.ceil(files.length / filesPerPage);
                const startIdx = (currentPage - 1) * filesPerPage;
                const endIdx = startIdx + filesPerPage;
                const paginatedFiles = files.slice(startIdx, endIdx);

                return paginatedFiles.map((file) => (
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
                      {selectionMode && (
                        <div className="absolute top-2 left-2">
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(file.id)}
                            onChange={() => toggleFileSelection(file.id)}
                            className="w-5 h-5 cursor-pointer"
                          />
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
                      <div className="space-y-2">
                        <div className="flex gap-2 pt-3 border-t border-border">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleDownload(file)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleViewMetadata(file)}
                            title="View embedded metadata"
                          >
                            <Info className="w-4 h-4 mr-1" />
                            Metadata
                          </Button>
                        </div>
                        {canDelete && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(file.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ));
              })()}
            </div>

            {/* Pagination Controls */}
            {files.length > filesPerPage && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * filesPerPage) + 1}-{Math.min(currentPage * filesPerPage, files.length)} of {files.length} files
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm">
                    Page {currentPage} of {Math.ceil(files.length / filesPerPage)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(files.length / filesPerPage), p + 1))}
                    disabled={currentPage === Math.ceil(files.length / filesPerPage)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
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

      {deleteConfirmId && (
        <DeleteConfirmModal
          fileName={files.find(f => f.id === deleteConfirmId)?.original_filename || 'this file'}
          onConfirm={() => handleDelete(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      {showBulkEditor && (
        <BulkEditorModal
          selectedFiles={files.filter(f => selectedFiles.includes(f.id))}
          onClose={() => setShowBulkEditor(false)}
          onComplete={() => {
            setSelectionMode(false);
            setSelectedFiles([]);
            fetchData();
          }}
        />
      )}

      {metadataViewerFile && (
        <MetadataViewer
          metadata={metadataViewerFile.metadata}
          filename={metadataViewerFile.filename}
          onClose={() => setMetadataViewerFile(null)}
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
  // ✨ NEW: Metadata options state
  const [removeMetadata, setRemoveMetadata] = useState(false);
  const [addMetadata, setAddMetadata] = useState(true); // Default: add creator metadata

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
      // ✨ NEW: Pass metadata options to upload
      await mediaApi.upload(file, editorId, tagArray, description, {
        removeMetadata,
        addMetadata,
      });
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

          {/* ✨ NEW: Metadata Options */}
          <div className="space-y-3 p-4 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <label className="text-sm font-medium block">Metadata Options</label>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeMetadata}
                  onChange={(e) => setRemoveMetadata(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">Remove existing metadata before upload</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addMetadata}
                  onChange={(e) => setAddMetadata(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">Embed creator metadata (editor name, date, tags)</span>
              </label>
            </div>

            {removeMetadata && addMetadata && (
              <p className="text-xs text-muted-foreground mt-2">
                ℹ️ File will be cleaned first, then creator metadata will be embedded
              </p>
            )}
            {!removeMetadata && !addMetadata && (
              <p className="text-xs text-muted-foreground mt-2">
                ℹ️ File will be uploaded as-is without metadata modifications
              </p>
            )}
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

function DeleteConfirmModal({
  fileName,
  onConfirm,
  onCancel,
}: {
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Delete File</h2>
            <button
              type="button"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-muted-foreground">
              Are you sure you want to delete <strong>{fileName}</strong>?
            </p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. The file will be permanently removed from the library.
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={onConfirm}
            >
              Delete
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BulkEditorModal({
  selectedFiles,
  onClose,
  onComplete,
}: {
  selectedFiles: MediaFile[];
  onClose: () => void;
  onComplete: () => void;
}) {
  return (
    <BulkMetadataEditor
      selectedFiles={selectedFiles}
      onClose={onClose}
      onComplete={() => {
        onComplete();
        onClose();
      }}
    />
  );
}
