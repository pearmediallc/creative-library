import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { permissionApi, mediaApi, folderApi } from '../lib/api';
import { formatBytes, formatDate } from '../lib/utils';
import { Image as ImageIcon, Video, Download, Folder, User, Info } from 'lucide-react';

interface SharedResource {
  resource_type: 'file' | 'folder';
  resource_id: string;
  resource_name: string;
  file_type?: string;
  file_size?: number;
  thumbnail_url?: string;
  s3_url?: string;
  download_url?: string;
  created_at: string;
  owner_name: string;
  owner_email: string;
  shared_at: string;
  permissions: string[];
}

export function SharedWithMePage() {
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSharedResources();
  }, []);

  const fetchSharedResources = async () => {
    try {
      setLoading(true);
      const response = await permissionApi.getSharedWithMe();
      setResources(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch shared resources:', err);
      setError(err.response?.data?.error || 'Failed to load shared resources');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (resource: SharedResource) => {
    if (resource.resource_type !== 'file') return;

    try {
      // Use authenticated fetch with Bearer token to download file
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const downloadUrl = `${API_BASE}/media/${resource.resource_id}/download`;
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
      link.download = resource.resource_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  const getPermissionBadge = (permissionType: string) => {
    const colors: Record<string, string> = {
      view: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      download: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      edit: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      delete: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    return (
      <span
        key={permissionType}
        className={`px-2 py-1 text-xs font-medium rounded ${colors[permissionType] || 'bg-gray-100 text-gray-800'}`}
      >
        {permissionType}
      </span>
    );
  };

  const hasPermission = (resource: SharedResource, permission: string) => {
    return resource.permissions.includes(permission);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Shared with me</h1>
          <p className="text-muted-foreground">
            Files and folders that other users have shared with you
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-md bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {/* Resources Grid */}
        {resources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {resources.map((resource) => (
              <Card key={`${resource.resource_type}-${resource.resource_id}`} className="overflow-hidden">
                {/* Preview/Thumbnail */}
                <div className="aspect-video bg-muted relative">
                  {resource.resource_type === 'file' ? (
                    resource.thumbnail_url ? (
                      <img
                        src={resource.thumbnail_url}
                        alt={resource.resource_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        {resource.file_type === 'image' ? (
                          <ImageIcon className="w-16 h-16 text-muted-foreground" />
                        ) : (
                          <Video className="w-16 h-16 text-muted-foreground" />
                        )}
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                      <Folder className="w-16 h-16 text-blue-500" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-background/80 backdrop-blur">
                      {resource.resource_type}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  {/* Resource Name */}
                  <h3 className="font-medium truncate" title={resource.resource_name}>
                    {resource.resource_name}
                  </h3>

                  {/* Owner Info */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span className="truncate">Shared by {resource.owner_name}</span>
                  </div>

                  {/* File Details */}
                  {resource.resource_type === 'file' && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      {resource.file_size && <p>Size: {formatBytes(resource.file_size)}</p>}
                      <p>Shared: {formatDate(resource.shared_at)}</p>
                    </div>
                  )}

                  {/* Folder Details */}
                  {resource.resource_type === 'folder' && (
                    <div className="text-sm text-muted-foreground">
                      <p>Shared: {formatDate(resource.shared_at)}</p>
                    </div>
                  )}

                  {/* Permission Badges */}
                  <div className="flex flex-wrap gap-1">
                    {resource.permissions.map((perm) => getPermissionBadge(perm))}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-border space-y-2">
                    {resource.resource_type === 'file' && hasPermission(resource, 'download') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleDownload(resource)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    )}
                    {resource.resource_type === 'folder' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          // Navigate to folder - you can implement this later
                          alert('Folder navigation coming soon');
                        }}
                      >
                        <Folder className="w-4 h-4 mr-2" />
                        Open Folder
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
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">No files have been shared with you yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  When other users share files or folders with you, they will appear here
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
