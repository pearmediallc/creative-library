import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { mediaApi, starredApi } from '../lib/api';
import { MediaFile } from '../types';
import { formatBytes, formatDate } from '../lib/utils';
import { Image as ImageIcon, Video, Download, Share2, Star, Clock, LayoutGrid, List, FileText } from 'lucide-react';
import { ShareDialog } from '../components/ShareDialog';

type ViewMode = 'grid' | 'list';

export function RecentsPage() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [starredFileIds, setStarredFileIds] = useState<Set<string>>(new Set());
  const [shareDialogFile, setShareDialogFile] = useState<{
    id: string;
    name: string;
    type: 'file' | 'folder';
  } | null>(null);

  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('recentsViewMode');
    return (saved === 'list' || saved === 'grid') ? saved : 'grid';
  });

  useEffect(() => {
    fetchRecentFiles();
    fetchStarredFiles();
  }, []);

  const fetchRecentFiles = async () => {
    try {
      setLoading(true);
      const response = await mediaApi.getAll({});
      const allFiles = response.data.data.files || [];

      // Sort by created_at DESC and take first 50
      const sortedFiles = allFiles
        .sort((a: MediaFile, b: MediaFile) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .slice(0, 50);

      setFiles(sortedFiles);
    } catch (error: any) {
      console.error('Failed to fetch recent files:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStarredFiles = async () => {
    try {
      const response = await starredApi.getStarredFiles();
      const starred = response.data.data || [];
      setStarredFileIds(new Set(starred.map((f: MediaFile) => f.id)));
    } catch (error: any) {
      console.error('Failed to fetch starred files:', error);
    }
  };

  const handleDownload = async (file: MediaFile) => {
    try {
      const url = file.s3_url || file.download_url;
      if (!url) return;

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

  const handleToggleStar = async (fileId: string, isCurrentlyStarred: boolean) => {
    try {
      await starredApi.toggleStarred(fileId, !isCurrentlyStarred);

      // Update local state
      setStarredFileIds(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyStarred) {
          newSet.delete(fileId);
        } else {
          newSet.add(fileId);
        }
        return newSet;
      });
    } catch (error: any) {
      console.error('Failed to toggle star:', error);
      alert(error.response?.data?.error || 'Failed to update starred status');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Recent Files</h1>
            <p className="text-muted-foreground">Recently accessed files in your library</p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex border rounded-md overflow-hidden">
            <button
              onClick={() => {
                setViewMode('grid');
                localStorage.setItem('recentsViewMode', 'grid');
              }}
              className={`px-3 py-2 flex items-center gap-2 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-accent'
              }`}
              title="Grid view"
            >
              <LayoutGrid size={16} />
              <span className="text-sm">Grid</span>
            </button>
            <button
              onClick={() => {
                setViewMode('list');
                localStorage.setItem('recentsViewMode', 'list');
              }}
              className={`px-3 py-2 flex items-center gap-2 transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-accent'
              }`}
              title="List view"
            >
              <List size={16} />
              <span className="text-sm">List</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : files.length > 0 ? (
          <>
            {viewMode === 'grid' ? (
              /* Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {files.map((file) => {
                  const isStarred = starredFileIds.has(file.id);

                  return (
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
                            ) : file.file_type === 'video' ? (
                              <Video className="w-16 h-16 text-muted-foreground" />
                            ) : file.original_filename.toLowerCase().endsWith('.pdf') ? (
                              <FileText className="w-16 h-16 text-muted-foreground" />
                            ) : (
                              <ImageIcon className="w-16 h-16 text-muted-foreground" />
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
                              onClick={() => setShareDialogFile({
                                id: file.id,
                                name: file.original_filename,
                                type: 'file'
                              })}
                              title="Share with people or get link"
                            >
                              <Share2 className="w-4 h-4 mr-1" />
                              Share
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className={`flex-1 ${
                                isStarred
                                  ? 'text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400'
                                  : ''
                              }`}
                              onClick={() => handleToggleStar(file.id, isStarred)}
                              title={isStarred ? 'Remove from starred' : 'Add to starred'}
                            >
                              <Star className={`w-4 h-4 mr-1 ${isStarred ? 'fill-current' : ''}`} />
                              {isStarred ? 'Starred' : 'Star'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr className="border-b">
                      <th className="text-left p-3 w-16"></th>
                      <th className="text-left p-3 font-medium">Filename</th>
                      <th className="text-left p-3 font-medium">Editor</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">Size</th>
                      <th className="text-left p-3 font-medium">Uploaded</th>
                      <th className="text-left p-3 font-medium w-64">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, index) => {
                      const isStarred = starredFileIds.has(file.id);

                      return (
                        <tr
                          key={file.id}
                          className={`border-b transition-colors hover:bg-muted/50 ${
                            index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                          }`}
                        >
                          <td className="p-3">
                            <div className="w-12 h-12 rounded overflow-hidden bg-muted flex items-center justify-center">
                              {file.thumbnail_url ? (
                                <img
                                  src={file.thumbnail_url}
                                  alt={file.original_filename}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                file.file_type === 'image' ? (
                                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                ) : file.file_type === 'video' ? (
                                  <Video className="w-6 h-6 text-muted-foreground" />
                                ) : file.original_filename.toLowerCase().endsWith('.pdf') ? (
                                  <FileText className="w-6 h-6 text-muted-foreground" />
                                ) : (
                                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                )
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate max-w-xs" title={file.original_filename}>
                                {file.original_filename}
                              </span>
                              {isStarred && (
                                <Star className="w-4 h-4 fill-yellow-500 text-yellow-500 flex-shrink-0" />
                              )}
                            </div>
                            {file.tags && file.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {file.tags.slice(0, 3).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.5 text-xs rounded bg-accent/20 text-accent-foreground"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {file.editor_name || 'N/A'}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-1 text-xs font-medium rounded bg-accent/20">
                              {file.file_type}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {formatBytes(file.file_size)}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {formatDate(file.created_at)}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDownload(file)}
                                className="p-1.5 hover:bg-accent rounded transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setShareDialogFile({
                                  id: file.id,
                                  name: file.original_filename,
                                  type: 'file'
                                })}
                                className="p-1.5 hover:bg-accent rounded transition-colors"
                                title="Share"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleStar(file.id, isStarred)}
                                className="p-1.5 hover:bg-accent rounded transition-colors"
                                title={isStarred ? 'Remove from starred' : 'Add to starred'}
                              >
                                <Star className={`w-4 h-4 ${isStarred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">No recent files</h3>
                <p className="text-muted-foreground">
                  Upload files to the Media Library to see them here
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Share Dialog */}
      {shareDialogFile && (
        <ShareDialog
          isOpen={true}
          onClose={() => setShareDialogFile(null)}
          resourceId={shareDialogFile.id}
          resourceName={shareDialogFile.name}
          resourceType={shareDialogFile.type}
        />
      )}
    </DashboardLayout>
  );
}
