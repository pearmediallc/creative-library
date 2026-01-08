import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { mediaApi } from '../lib/api';
import { MediaFile } from '../types';
import { formatBytes, formatDate } from '../lib/utils';
import { Image as ImageIcon, Video, RotateCcw, Trash2, AlertTriangle, FileText, File } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function DeletedFilesPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [permanentDeleting, setPermanentDeleting] = useState<string | null>(null);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchDeletedFiles();
  }, []);

  const fetchDeletedFiles = async () => {
    try {
      setLoading(true);
      const response = await mediaApi.getDeletedFiles();
      const deletedFiles = response.data.data || [];
      console.log('Fetched deleted files:', deletedFiles.length, deletedFiles);
      setFiles(deletedFiles);
    } catch (error: any) {
      console.error('Failed to fetch deleted files:', error);
      alert(error.response?.data?.error || 'Failed to fetch deleted files');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (fileId: string) => {
    try {
      setRestoring(fileId);
      await mediaApi.restore(fileId);
      alert('File restored successfully');
      fetchDeletedFiles();
    } catch (error: any) {
      console.error('Failed to restore file:', error);
      alert(error.response?.data?.error || 'Failed to restore file');
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (fileId: string, filename: string) => {
    const confirmed = window.confirm(
      `Permanently delete "${filename}"?\n\nThis action cannot be undone. The file will be completely removed from storage.`
    );

    if (!confirmed) return;

    try {
      setPermanentDeleting(fileId);
      await mediaApi.permanentDelete(fileId);
      alert('File permanently deleted');
      fetchDeletedFiles();
    } catch (error: any) {
      console.error('Failed to permanently delete file:', error);
      alert(error.response?.data?.error || 'Failed to permanently delete file');
    } finally {
      setPermanentDeleting(null);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      setEmptyingTrash(true);
      await mediaApi.emptyTrash();
      alert('Trash emptied successfully');
      setShowEmptyTrashConfirm(false);
      fetchDeletedFiles();
    } catch (error: any) {
      console.error('Failed to empty trash:', error);
      alert(error.response?.data?.error || 'Failed to empty trash');
    } finally {
      setEmptyingTrash(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trash</h1>
            <p className="text-muted-foreground">
              Deleted files are stored here for 30 days before permanent deletion
            </p>
          </div>
          {isAdmin && files.length > 0 && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowEmptyTrashConfirm(true)}
              disabled={emptyingTrash}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {emptyingTrash ? 'Emptying...' : 'Empty Trash'}
            </Button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : files.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {files.map((file) => (
              <Card key={file.id} className="overflow-hidden opacity-75 hover:opacity-100 transition-opacity">
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {(file.thumbnail_url || file.s3_url) ? (
                    <img
                      src={file.thumbnail_url || file.s3_url}
                      alt={file.original_filename}
                      className="w-full h-full object-cover grayscale"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to placeholder icon on error
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) {
                          fallback.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="absolute inset-0 flex items-center justify-center h-full grayscale bg-muted"
                    style={{ display: (file.thumbnail_url || file.s3_url) ? 'none' : 'flex' }}
                  >
                    {file.file_type === 'image' ? (
                      <ImageIcon className="w-16 h-16 text-muted-foreground" />
                    ) : file.file_type === 'video' ? (
                      <Video className="w-16 h-16 text-muted-foreground" />
                    ) : file.original_filename?.toLowerCase().endsWith('.pdf') ? (
                      <FileText className="w-16 h-16 text-muted-foreground" />
                    ) : (
                      <File className="w-16 h-16 text-muted-foreground" />
                    )}
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-destructive/80 text-destructive-foreground backdrop-blur">
                      Deleted
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
                    <p>Original location: {file.folder_id || 'Root folder'}</p>
                    <p className="text-destructive">
                      Deleted: {file.deleted_at ? formatDate(file.deleted_at) : 'Unknown'}
                    </p>
                    {file.deleted_by && (
                      <p className="text-xs">By: {file.uploader_name || 'Unknown user'}</p>
                    )}
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
                  <div className="flex gap-2 pt-3 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleRestore(file.id)}
                      disabled={restoring === file.id}
                      title="Restore file to its original location"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      {restoring === file.id ? 'Restoring...' : 'Restore'}
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive hover:text-destructive"
                        onClick={() => handlePermanentDelete(file.id, file.original_filename)}
                        disabled={permanentDeleting === file.id}
                        title="Permanently delete this file (cannot be undone)"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        {permanentDeleting === file.id ? 'Deleting...' : 'Delete Forever'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Trash is empty</h3>
                <p className="text-muted-foreground">
                  Deleted files will appear here and be permanently removed after 30 days
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Empty Trash Confirmation Modal */}
      {showEmptyTrashConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white dark:bg-gray-900">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-2">Empty Trash?</h2>
                  <p className="text-muted-foreground mb-4">
                    This will permanently delete all {files.length} file{files.length !== 1 ? 's' : ''} in the trash.
                  </p>
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
                    <p className="text-sm text-destructive font-medium">
                      Warning: This action cannot be undone!
                    </p>
                    <p className="text-xs text-destructive/80 mt-1">
                      All files will be completely removed from storage.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEmptyTrashConfirm(false)}
                  className="flex-1"
                  disabled={emptyingTrash}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  onClick={handleEmptyTrash}
                  disabled={emptyingTrash}
                >
                  {emptyingTrash ? 'Emptying...' : 'Empty Trash'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
