import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { starredApi } from '../lib/api';
import { MediaFile } from '../types';
import { formatBytes, formatDate } from '../lib/utils';
import { Image as ImageIcon, Video, Download, Star, FileText } from 'lucide-react';

export function StarredPage() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStarredFiles();
  }, []);

  const fetchStarredFiles = async () => {
    try {
      setLoading(true);
      const response = await starredApi.getStarredFiles();
      setFiles(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch starred files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: MediaFile) => {
    try {
      // Use authenticated fetch with Bearer token to download file
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const downloadUrl = `${API_BASE}/media/${file.id}/download`;
      const token = localStorage.getItem('token');

      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  const handleUnstar = async (fileId: string) => {
    try {
      await starredApi.toggleStarred(fileId, false);
      fetchStarredFiles();
    } catch (error: any) {
      console.error('Failed to unstar file:', error);
      alert(error.response?.data?.error || 'Failed to unstar file');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Starred Files</h1>
            <p className="text-muted-foreground">Quick access to your favorite files</p>
          </div>
        </div>

        {/* Content */}
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
                      className="flex-1 text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400"
                      onClick={() => handleUnstar(file.id)}
                      title="Remove from starred"
                    >
                      <Star className="w-4 h-4 mr-1 fill-current" />
                      Unstar
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Star className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">No starred files yet</h3>
                <p className="text-muted-foreground">
                  Star files from the Media Library to quickly access them here
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
